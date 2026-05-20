import { productsService } from '../../modules/products/products.service';
import { logger } from '../../shared/middlewares/logger';
import {
  PRODUCT_ALIASES,
  CATEGORY_SUGGESTIONS,
  INTENT_KEYWORDS,
} from './nlp.aliases';

interface ParsedItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  valid: boolean;
}

interface ParsedMessage {
  intent: string;
  products: ParsedItem[];
  message: string;
  needs_confirmation: boolean;
  confidence: number;
  suggestions: string[];
}

// Number words → digits
const NUMBER_WORDS: Record<string, number> = {
  'um': 1, 'uma': 1,
  'dois': 2, 'duas': 2,
  'tres': 3, 'três': 3,
  'quatro': 4, 'cinco': 5,
  'seis': 6, 'sete': 7,
  'oito': 8, 'nove': 9, 'dez': 10,
  'meia': 0.5, 'meio': 0.5,
};

class NLPService {
  private catalog: any[] = [];
  private allProducts: any[] = [];
  private catalogLoaded = false;

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async ensureCatalog() {
    if (!this.catalogLoaded) {
      this.catalog = await productsService.getCatalog();
      this.allProducts = this.catalog.flatMap((cat: any) => cat.products);
      this.catalogLoaded = true;
    }
  }

  async parseMessage(message: string, session?: any): Promise<ParsedMessage> {
    await this.ensureCatalog();

    const normalized = this.normalize(message);
    const context = session ? JSON.parse(session.context || '{}') : {};

    // 1. Check for removal intent
    if (this.isRemovalIntent(normalized)) {
      return this.handleRemoval(normalized, context);
    }

    // 2. Extract products from the message
    const extracted = this.extractProducts(normalized);

    // 3. If we found products, it's an order
    if (extracted.length > 0) {
      // Check for ambiguous products (multiple matches for same alias)
      const ambiguous = extracted.find(e => e.ambiguous);
      if (ambiguous) {
        return {
          intent: 'novo_pedido',
          products: [],
          message: `Você quer ${ambiguous.alias}? Temos:\n${(ambiguous.options || []).map((o: any) => `• ${o.name} - R$ ${(o.promo_price || o.price).toFixed(2)}`).join('\n')}\n\nQual deles?`,
          needs_confirmation: false,
          confidence: 0.8,
          suggestions: (ambiguous.options || []).map((o: any) => o.name),
        };
      }

      // All products resolved
      const items: ParsedItem[] = extracted.map(e => ({
        product_id: e.product.id,
        name: e.product.name,
        quantity: e.quantity,
        price: e.product.promo_price || e.product.price,
        valid: true,
      }));

      // Merge with existing items if in order flow
      const existingItems = context.items || [];
      const merged = this.mergeItems(existingItems, items);

      const displayItems = merged.map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        total: i.price * i.quantity,
      }));
      const subtotal = displayItems.reduce((sum: number, i: any) => sum + i.total, 0);

      const summary = this.buildOrderSummary(displayItems, subtotal, context.items?.length > 0);

      return {
        intent: 'novo_pedido',
        products: items,
        message: summary,
        needs_confirmation: true,
        confidence: 0.95,
        suggestions: [],
      };
    }

    // 4. Check for category keywords (generic: "quero cerveja")
    const categoryMatch = this.matchCategory(normalized);
    if (categoryMatch) {
      const options = categoryMatch.products.map((name: string) => {
        const p = this.allProducts.find((ap: any) => this.normalize(ap.name).includes(this.normalize(name)) || this.normalize(name).includes(this.normalize(ap.name)));
        return p ? `• ${p.name} - R$ ${(p.promo_price || p.price).toFixed(2)}` : `• ${name}`;
      }).join('\n');

      return {
        intent: 'novo_pedido',
        products: [],
        message: `Temos ${categoryMatch.category}:\n${options}\n\nQual prefere?`,
        needs_confirmation: false,
        confidence: 0.8,
        suggestions: categoryMatch.products,
      };
    }

    // 5. Check for order intent keywords without products
    if (this.isOrderIntent(normalized)) {
      return {
        intent: 'novo_pedido',
        products: [],
        message: 'O que você gostaria de pedir? 😊\n\nExemplos:\n• *2 Coca Zero*\n• *1 Heineken e 1 Batata*\n• *3 Skol*',
        needs_confirmation: false,
        confidence: 0.7,
        suggestions: [],
      };
    }

    // 6. Check for price inquiry
    const priceInq = this.checkPriceInquiry(normalized);
    if (priceInq) return priceInq;

    // 7. Check for follow-up questions (tem outras?, mais opções?)
    const followup = this.checkFollowup(normalized, context);
    if (followup) return followup;

    // 8. Detect other intents
    const intent = this.detectIntent(normalized);
    return {
      intent,
      products: [],
      message: this.buildIntentMessage(intent, context),
      needs_confirmation: false,
      confidence: 0.6,
      suggestions: [],
    };
  }

  private extractProducts(message: string): Array<{ product: any; quantity: number; alias: string; ambiguous?: boolean; options?: any[] }> {
    const results: Array<{ product: any; quantity: number; alias: string; ambiguous?: boolean; options?: any[] }> = [];
    const consumedRanges: Array<[number, number]> = []; // track matched character ranges

    // Sort aliases by length (longest first) to prefer more specific matches
    const sortedAliases = Object.entries(PRODUCT_ALIASES)
      .sort((a, b) => b[0].length - a[0].length);

    // Track which product IDs were already matched to avoid duplicates
    const matchedProductIds = new Set<string>();

    for (const [alias, productName] of sortedAliases) {
      const aliasNorm = this.normalize(alias);
      const idx = message.indexOf(aliasNorm);

      if (idx === -1) continue;

      const rangeEnd = idx + aliasNorm.length;

      // Check if this range overlaps with any already consumed range
      const overlaps = consumedRanges.some(([start, end]) =>
        (idx >= start && idx < end) || (rangeEnd > start && rangeEnd <= end) || (idx <= start && rangeEnd >= end)
      );
      if (overlaps) continue;

      // Find all products that match this alias name
      const candidates = this.allProducts.filter((p: any) =>
        this.normalize(p.name) === this.normalize(productName) && !matchedProductIds.has(p.id)
      );

      if (candidates.length === 0) continue;

      // Extract quantity: look for number BEFORE the alias
      const before = message.substring(0, idx).trim();
      const quantity = this.extractQuantity(before);

      if (candidates.length > 1) {
        results.push({
          product: candidates[0],
          quantity,
          alias,
          ambiguous: true,
          options: candidates,
        });
      } else {
        results.push({
          product: candidates[0],
          quantity,
          alias,
        });
        matchedProductIds.add(candidates[0].id);
      }

      consumedRanges.push([idx, rangeEnd]);
    }

    return results;
  }

  private extractQuantity(before: string): number {
    if (!before) return 1;

    const trimmed = before.trim();

    // Check for number at the end: "quero 2", "2x"
    const numMatch = trimmed.match(/(\d+)\s*x?\s*$/);
    if (numMatch) return parseInt(numMatch[1]);

    // Check for number words
    const words = trimmed.split(' ');
    const lastWord = words[words.length - 1];
    if (NUMBER_WORDS[lastWord]) return NUMBER_WORDS[lastWord];

    // Check for "2x" pattern anywhere
    const xMatch = trimmed.match(/(\d+)\s*x/);
    if (xMatch) return parseInt(xMatch[1]);

    return 1;
  }

  private mergeItems(existing: any[], newItems: ParsedItem[]): any[] {
    const map = new Map<string, any>();

    for (const item of existing) {
      if (item.product_id) {
        map.set(item.product_id, { ...item });
      }
    }

    for (const item of newItems) {
      const existing_item = map.get(item.product_id);
      if (existing_item) {
        existing_item.quantity += item.quantity;
      } else {
        map.set(item.product_id, { ...item });
      }
    }

    return Array.from(map.values());
  }

  private buildOrderSummary(items: any[], subtotal: number, isAddition: boolean): string {
    const lines: string[] = [];

    if (isAddition) {
      lines.push('🛒 *Itens adicionados!*\n');
    }

    lines.push('📋 *Pedido:*\n');
    for (const item of items) {
      lines.push(`• ${item.quantity}x ${item.name} - R$ ${item.total.toFixed(2)}`);
    }
    lines.push(`\n💰 *Total: R$ ${subtotal.toFixed(2)}*`);
    lines.push('\n✅ Confirmar?\n❌ Remover item\n➕ Adicionar mais');

    return lines.join('\n');
  }

  private isRemovalIntent(message: string): boolean {
    const removalWords = ['remover', 'remove', 'tirar', 'tira', 'retirar', 'retira', 'excluir', 'deletar'];
    return removalWords.some(w => message.startsWith(w) || message.includes(`tira `) || message.includes(`remove `));
  }

  private handleRemoval(message: string, context: any): ParsedMessage {
    const items = context.items || [];
    if (items.length === 0) {
      return {
        intent: 'novo_pedido',
        products: [],
        message: 'Você não tem itens no pedido para remover. 🛒',
        needs_confirmation: false,
        confidence: 0.9,
        suggestions: [],
      };
    }

    // Extract products from the removal message
    const extracted = this.extractProducts(message);

    if (extracted.length > 0) {
      // Check for "deixar/trocar por" pattern — remove one, add another
      const keepWords = ['deixar', 'trocar', 'substituir', 'por', 'em vez'];
      const hasKeep = keepWords.some(w => message.includes(this.normalize(w)));

      if (hasKeep && extracted.length >= 2) {
        // "remover coca normal e deixar a zero" — first = remove, second = keep
        const toRemove = extracted[0].product;
        const toKeep = extracted[extracted.length - 1].product;

        // Remove the first product, add/replace with the second
        let remaining = items.filter((i: any) => i.product_id !== toRemove.id);

        // Add or update the kept product
        const existingKeep = remaining.find((i: any) => i.product_id === toKeep.id);
        if (existingKeep) {
          // Already in cart, just keep it
        } else {
          remaining.push({
            product_id: toKeep.id,
            name: toKeep.name,
            quantity: 1,
            price: toKeep.promo_price || toKeep.price,
          });
        }

        const displayItems = remaining.map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          total: i.price * i.quantity,
        }));
        const subtotal = displayItems.reduce((sum: number, i: any) => sum + i.total, 0);

        return {
          intent: 'novo_pedido',
          products: remaining.map((i: any) => ({ ...i, valid: true })),
          message: `✅ Trocado! ${toRemove.name} → ${toKeep.name}\n\n${this.buildOrderSummary(displayItems, subtotal, false)}`,
          needs_confirmation: remaining.length > 0,
          confidence: 0.95,
          suggestions: [],
        };
      }

      // Simple removal — remove all extracted products
      const toRemove = extracted[0].product;
      const remaining = items.filter((i: any) => i.product_id !== toRemove.id);

      if (remaining.length === items.length) {
        return {
          intent: 'novo_pedido',
          products: [],
          message: `${toRemove.name} não está no seu pedido. Itens atuais:\n${items.map((i: any) => `• ${i.quantity}x ${i.name}`).join('\n')}`,
          needs_confirmation: false,
          confidence: 0.9,
          suggestions: [],
        };
      }

      const displayItems = remaining.map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        total: i.price * i.quantity,
      }));
      const subtotal = displayItems.reduce((sum: number, i: any) => sum + i.total, 0);

      return {
        intent: 'novo_pedido',
        products: remaining.map((i: any) => ({ ...i, valid: true })),
        message: `✅ ${toRemove.name} removido!\n\n${this.buildOrderSummary(displayItems, subtotal, false)}`,
        needs_confirmation: remaining.length > 0,
        confidence: 0.95,
        suggestions: [],
      };
    }

    // Show current items for removal
    return {
      intent: 'novo_pedido',
      products: [],
      message: `Qual item deseja remover?\n${items.map((i: any) => `• ${i.quantity}x ${i.name}`).join('\n')}\n\nDigite: *tirar [item]*`,
      needs_confirmation: false,
      confidence: 0.8,
      suggestions: items.map((i: any) => i.name),
    };
  }

  private matchCategory(message: string): { category: string; products: string[] } | null {
    for (const [cat, products] of Object.entries(CATEGORY_SUGGESTIONS)) {
      if (message.includes(this.normalize(cat))) {
        return { category: cat, products };
      }
    }
    return null;
  }

  private isOrderIntent(message: string): boolean {
    const orderWords = ['quero', 'pedir', 'pedido', 'gostaria', 'manda', 'me manda', 'me ve', 'traz', 'vou querer', 'vou levar', 'queria'];
    return orderWords.some(w => message.startsWith(w) || message.includes(` ${w} `));
  }

  private checkPriceInquiry(message: string): ParsedMessage | null {
    const patterns = [
      /quanto\s+(ta|tacusta|e)\s+(.+)/,
      /preco\s+(do|da|de)\s+(.+)/,
      /valor\s+(do|da|de)\s+(.+)/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const query = match[2]?.trim();
        if (query) {
          const extracted = this.extractProducts(query);
          if (extracted.length > 0) {
            const p = extracted[0].product;
            const price = p.promo_price || p.price;
            return {
              intent: 'novo_pedido',
              products: [],
              message: `${p.name} está R$ ${price.toFixed(2)}. Quantas deseja?`,
              needs_confirmation: false,
              confidence: 0.9,
              suggestions: [],
            };
          }
        }
      }
    }
    return null;
  }

  private checkFollowup(message: string, context: any): ParsedMessage | null {
    const followupPatterns = [
      /tem\s+(outra|outro|mais)/,
      /mais\s+opcoes/,
      /outra\s+opcao/,
      /o que mais/,
      /tem\s+o que/,
    ];

    const isFollowup = followupPatterns.some(p => p.test(message));
    if (!isFollowup) return null;

    // Try to find category from context
    const category = this.getCategoryFromContext(context);
    if (category) {
      const catData = CATEGORY_SUGGESTIONS[category];
      if (catData) {
        const options = catData.map((name: string) => {
          const p = this.allProducts.find((ap: any) => this.normalize(ap.name).includes(this.normalize(name)));
          return p ? `• ${p.name} - R$ ${(p.promo_price || p.price).toFixed(2)}` : `• ${name}`;
        }).join('\n');

        return {
          intent: 'novo_pedido',
          products: [],
          message: `Também temos:\n${options}\n\nQual prefere?`,
          needs_confirmation: false,
          confidence: 0.8,
          suggestions: catData,
        };
      }
    }

    return null;
  }

  private getCategoryFromContext(context: any): string | null {
    if (!context.history) return null;
    const recent = context.history.slice(-4);
    for (const msg of recent) {
      const content = this.normalize(msg.content || '');
      for (const cat of Object.keys(CATEGORY_SUGGESTIONS)) {
        if (content.includes(this.normalize(cat))) return cat;
      }
    }
    return null;
  }

  private detectIntent(message: string): string {
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      for (const kw of keywords) {
        if (message.includes(this.normalize(kw))) return intent;
      }
    }
    return 'outro';
  }

  private buildIntentMessage(intent: string, context: any): string {
    switch (intent) {
      case 'cardapio':
        return 'Aqui está nosso cardápio! Digite *1* para ver.';
      case 'acompanhar':
        if (context.lastOrderId) {
          return `Seu pedido #${context.lastOrderNumber || ''} está em preparo. 🍳`;
        }
        return 'Você não tem pedidos ativos no momento. 🛒';
      case 'cancelar':
        return 'Para cancelar, confirme o pedido primeiro e depois solicite o cancelamento.';
      case 'promocao':
        return 'Confira nosso cardápio com preços atualizados! Digite *1* para ver.';
      case 'ajuda':
        return 'Como posso ajudar?\n\n*1* - Ver cardápio\n*2* - Fazer pedido\n*3* - Acompanhar pedido\n*4* - Falar com atendente';
      default:
        return 'Desculpe, não entendi. 😅\n\nDigite o que deseja pedir!\nEx: *2 Coca Zero, 1 Heineken*';
    }
  }
}

export const nlpService = new NLPService();
