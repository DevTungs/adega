import { productsService } from '../../modules/products/products.service';
import { getDb } from '../../config/database';
import { logger } from '../../shared/middlewares/logger';
import { settingsAgent } from '../settings/settings.service';
import { AppError } from '../../shared/errors/app-error';
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
  variant_id?: string;
  halves?: Array<{ product_id: string; name: string; quantity: number }>;
  modifiers?: Array<{ modifier_id: string; option_id: string; option_name: string; price_add: number }>;
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
  private dbAliases: Record<string, string> = {};
  private dbCategorySuggestions: Record<string, string[]> = {};
  private variantAliases: Record<string, { variant: any; product: any }> = {};
  private modifierOptionAliases: Record<string, { product: any; modifier: any; option: any }> = {};
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

      // Load aliases from DB
      try {
        const db = getDb();
        const rows = db.all('SELECT pa.alias, p.name FROM product_aliases pa JOIN products p ON p.id = pa.product_id');
        this.dbAliases = {};
        for (const row of rows) {
          this.dbAliases[this.normalize(row.alias)] = row.name;
        }
      } catch { /* ignore */ }

      // Build category suggestions from catalog
      this.dbCategorySuggestions = {};
      for (const cat of this.catalog) {
        if (cat.products && cat.products.length > 0) {
          const names = cat.products.map((p: any) => p.name);
          this.dbCategorySuggestions[this.normalize(cat.name)] = names;
          // Also add slug as key
          if (cat.slug) this.dbCategorySuggestions[this.normalize(cat.slug)] = names;
        }
      }

      // Build variant aliases from products that have variants
      this.variantAliases = {};
      for (const cat of this.catalog) {
        for (const product of (cat.products || [])) {
          if (product.variants && product.variants.length > 0) {
            for (const v of product.variants) {
              if (v.is_active === 0) continue;
              // "calabresa grande" + "pizza calabresa grande"
              const keys = [
                `${this.normalize(product.name)} ${this.normalize(v.name)}`,
                `${this.normalize(v.name)} ${this.normalize(product.name)}`,
              ];
              for (const key of keys) {
                this.variantAliases[key] = { variant: v, product };
              }
            }
          }
        }
      }

      // Build modifier option aliases (flavors for creates_splits modifiers)
      this.modifierOptionAliases = {};
      for (const cat of this.catalog) {
        for (const product of (cat.products || [])) {
          for (const mod of (product.modifiers || [])) {
            if (mod.creates_splits && mod.options) {
              for (const opt of mod.options) {
                if (opt.is_active === 0) continue;
                const key = this.normalize(opt.name);
                this.modifierOptionAliases[key] = { product, modifier: mod, option: opt };
              }
            }
          }
        }
      }

      this.catalogLoaded = true;
    }
  }

  async parseMessage(message: string, session?: any): Promise<ParsedMessage> {
    await this.ensureCatalog();

    const normalized = this.normalize(message);
    const context = session ? JSON.parse(session.context || '{}') : {};

    // 0. Check for half-and-half pattern (meia X meia Y)
    if (normalized.includes('meia')) {
      const halfAndHalf = this.extractHalfAndHalf(normalized);
      if (halfAndHalf) {
        const product = this.allProducts.find(p => p.id === halfAndHalf.halves[0].product_id);
        const variant = halfAndHalf.variant_id
          ? (await import('../../modules/variants/variants.model')).variantsModel.findById(halfAndHalf.variant_id)
          : null;

        const price = variant ? (variant.promo_price ?? variant.price) : (product ? (product.promo_price ?? product.price) : 0);
        const modifiersTotal = (halfAndHalf.modifiers || []).reduce((s, m) => s + m.price_add, 0);
        const displayPrice = price + modifiersTotal;

        const item: ParsedItem = {
          product_id: product?.id || halfAndHalf.halves[0].product_id,
          name: halfAndHalf.message,
          quantity: 1,
          price: displayPrice,
          valid: true,
          variant_id: halfAndHalf.variant_id,
          halves: halfAndHalf.halves,
          modifiers: halfAndHalf.modifiers,
        };

        // If variant not specified, return asking for size
        if (!halfAndHalf.variant_id && product?.variants && product.variants.length > 0) {
          const varOptions = product.variants
            .filter((v: any) => v.is_active)
            .map((v: any) => `• ${v.name} - R$ ${(v.promo_price || v.price).toFixed(2)}`)
            .join('\n');
          return {
            intent: 'novo_pedido',
            products: [item],
            message: `Qual tamanho para ${halfAndHalf.halves.map(h => h.name).join(' + ')}?\n${varOptions}`,
            needs_confirmation: false,
            confidence: 0.9,
            suggestions: product.variants.map((v: any) => v.name),
          };
        }

        return {
          intent: 'novo_pedido',
          products: [item],
          message: `📋 Anotei:\n• 1x ${item.name} - R$ ${displayPrice.toFixed(2)}${halfAndHalf.modifiers?.length ? ` (com ${halfAndHalf.modifiers.map(m => m.option_name).join(', ')})` : ''}\n\n✅ Confirmar?\n➕ Adicionar mais`,
          needs_confirmation: true,
          confidence: 0.9,
          suggestions: [],
        };
      }
    }

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

      // Check if there's a category keyword in the message (e.g., "produto1, categoria e produto2")
      const categoryMatch = this.matchCategory(normalized);
      if (categoryMatch) {
        const items: ParsedItem[] = [];
        const outOfStock: string[] = [];

        for (const e of extracted) {
          const stock = e.product.stock ?? 999;
          if (stock <= 0) {
            outOfStock.push(e.product.name);
          } else {
            items.push({
              product_id: e.product.id,
              name: e.product.name,
              quantity: e.quantity,
              price: e.product.promo_price || e.product.price,
              valid: true,
            });
          }
        }

        const options = categoryMatch.products
          .map((name: string) => {
            const p = this.allProducts.find((ap: any) => this.normalize(ap.name).includes(this.normalize(name)));
            if (!p) return null;
            const stock = p.stock ?? 999;
            if (stock <= 0) return null; // hide out-of-stock from options
            return `• ${p.name} - R$ ${(p.promo_price || p.price).toFixed(2)}`;
          })
          .filter(Boolean)
          .join('\n');

        const itemList = items.map(i => `• ${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2)}`).join('\n');
        const warning = outOfStock.length > 0 ? `⚠️ *Sem estoque:* ${outOfStock.join(', ')}\n\n` : '';

        return {
          intent: 'novo_pedido',
          products: items,
          message: `${warning}📋 Já anotei:\n${itemList}\n\n📋 Para ${categoryMatch.category}, temos:\n${options}\n\nQual prefere?`,
          needs_confirmation: false,
          confidence: 0.9,
          suggestions: categoryMatch.products,
        };
      }

      // Check stock and build items
      const items: ParsedItem[] = [];
      const outOfStock: string[] = [];
      const lowStock: string[] = [];
      const needsVariant: any[] = [];

      for (const e of extracted) {
        // Check if product has variants and user hasn't specified one
        if (!e.variant_id && e.product.variants && e.product.variants.length > 0) {
          needsVariant.push(e);
          continue;
        }

        // Determine price: variant price > product price > extracted price
        let unitPrice = e.price ?? (e.product.promo_price || e.product.price);
        if (e.variant_id) {
          const v = e.product.variants?.find((v: any) => v.id === e.variant_id);
          if (v) unitPrice = v.promo_price ?? v.price;
        }
        const modifiersTotal = (e.modifiers || []).reduce((s, m) => s + m.price_add, 0);
        unitPrice += modifiersTotal;

        const stock = e.product.stock ?? 999;
        if (stock <= 0) {
          outOfStock.push(e.product.name);
        } else if (stock < e.quantity) {
          lowStock.push(`${e.product.name} (disponível: ${stock})`);
          items.push({
            product_id: e.product.id,
            name: e.product.name,
            quantity: stock,
            price: unitPrice,
            valid: true,
            variant_id: e.variant_id,
            modifiers: e.modifiers,
          });
        } else {
          items.push({
            product_id: e.product.id,
            name: e.product.name,
            quantity: e.quantity,
            price: unitPrice,
            valid: true,
            variant_id: e.variant_id,
            modifiers: e.modifiers,
          });
        }
      }

      // If any products need variant selection, ask
      if (needsVariant.length > 0) {
        const varList = needsVariant.map(e => {
          const options = e.product.variants
            .filter((v: any) => v.is_active)
            .map((v: any) => `• ${v.name} - R$ ${(v.promo_price || v.price).toFixed(2)}`)
            .join('\n');
          return `*${e.product.name}* tem opções:\n${options}`;
        }).join('\n\n');

        // Include the pending product info so the WhatsApp handler can transition to awaiting_variant
        const pendingProducts = needsVariant.map(e => ({
          product_id: e.product.id,
          name: e.product.name,
          quantity: e.quantity,
          price: e.price ?? (e.product.promo_price || e.product.price),
          valid: false,
          modifiers: e.modifiers,
        }));

        return {
          intent: 'novo_pedido',
          products: pendingProducts,
          message: `${varList}\n\nQual tamanho deseja?`,
          needs_confirmation: false,
          confidence: 0.8,
          suggestions: needsVariant.map((e: any) => e.product.name),
        };
      }

      // If any items are out of stock, warn the customer
      if (outOfStock.length > 0 || lowStock.length > 0) {
        const warnings: string[] = [];
        if (outOfStock.length > 0) {
          warnings.push(`❌ *Sem estoque:* ${outOfStock.join(', ')}`);
        }
        if (lowStock.length > 0) {
          warnings.push(`⚠️ *Estoque baixo:* ${lowStock.join(', ')}`);
        }

        if (items.length === 0) {
          return {
            intent: 'novo_pedido',
            products: [],
            message: `${warnings.join('\n')}\n\nDeseja ver outras opções?`,
            needs_confirmation: false,
            confidence: 0.9,
            suggestions: [],
          };
        }

        // Show warning + available items
        const itemList = items.map(i => `• ${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2)}`).join('\n');
        return {
          intent: 'novo_pedido',
          products: items,
          message: `${warnings.join('\n')}\n\n📋 *Itens disponíveis:*\n${itemList}\n\n✅ Confirmar?\n➕ Adicionar mais`,
          needs_confirmation: true,
          confidence: 0.9,
          suggestions: [],
        };
      }

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
        products: merged.map((i: any) => ({ ...i, valid: true })),
        message: summary,
        needs_confirmation: true,
        confidence: 0.95,
        suggestions: [],
      };
    }

    // 4. Check for category keywords (generic: "quero [categoria]")
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
        message: 'O que você gostaria de pedir? 😊\n\nDigite o nome do produto que deseja.',
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

  private extractHalfAndHalf(message: string): { halves: Array<{ product_id: string; name: string; quantity: number }>; variant_id?: string; message: string; modifiers?: Array<{ modifier_id: string; option_id: string; option_name: string; price_add: number }> } | null {
    // Pattern: "meia X (e) meia Y", "meio X e meio Y", "1/2 X e 1/2 Y"
    const halfPattern = /meia\s+(.+?)(?:\s+e\s+|\s+meia\s+)(.+)/i;
    const match = message.match(halfPattern);
    if (!match) return null;

    const half1 = this.normalize(match[1].trim());
    const half2 = this.normalize(match[2].trim());

    if (!half1 || !half2) return null;

    // Look for a variant (size) in the message
    let variantId: string | undefined;
    let sizeName = '';

    for (const [key, data] of Object.entries(this.variantAliases)) {
      if (message.includes(key)) {
        variantId = data.variant.id;
        sizeName = data.variant.name;
        break;
      }
    }

    // Try to match halves as modifier options (flavors) first
    const mod1 = this.modifierOptionAliases[half1];
    const mod2 = this.modifierOptionAliases[half2];

    if (mod1 && mod2 && mod1.product.id === mod2.product.id) {
      const product = mod1.product;
      return {
        halves: [
          { product_id: product.id, name: mod1.option.name, quantity: 1 },
          { product_id: product.id, name: mod2.option.name, quantity: 1 },
        ],
        variant_id: variantId,
        message: `${product.name} ${sizeName ? sizeName + ' ' : ''}(meia ${mod1.option.name} + meia ${mod2.option.name})`,
        modifiers: [
          { modifier_id: mod1.modifier.id, option_id: mod1.option.id, option_name: mod1.option.name, price_add: mod1.option.price_add },
          { modifier_id: mod2.modifier.id, option_id: mod2.option.id, option_name: mod2.option.name, price_add: mod2.option.price_add },
        ],
      };
    }

    // Fallback: try to find the products for each half
    const product1 = this.findProductByName(half1);
    const product2 = this.findProductByName(half2);

    if (!product1 || !product2) return null;

    return {
      halves: [
        { product_id: product1.id, name: product1.name, quantity: 1 },
        { product_id: product2.id, name: product2.name, quantity: 1 },
      ],
      variant_id: variantId,
      message: `Pizza ${sizeName ? sizeName + ' ' : ''}(meia ${product1.name} + meia ${product2.name})`,
    };
  }

  private extractModifiers(message: string, productId?: string): Array<{ modifier_id: string; option_id: string; option_name: string; price_add: number }> {
    if (!productId) return [];
    const product = this.allProducts.find((p: any) => p.id === productId);
    if (!product || !product.modifiers) return [];

    const result: Array<{ modifier_id: string; option_id: string; option_name: string; price_add: number }> = [];

    for (const mod of product.modifiers) {
      if (!mod.options) continue;
      for (const opt of mod.options) {
        if (!opt.is_active) continue;
        const optNorm = this.normalize(opt.name);
        if (message.includes(optNorm)) {
          result.push({
            modifier_id: mod.id,
            option_id: opt.id,
            option_name: opt.name,
            price_add: opt.price_add,
          });
        }
      }
    }

    return result;
  }

  private findProductByName(normalizedName: string): any | null {
    // Try exact match first
    for (const p of this.allProducts) {
      if (this.normalize(p.name) === normalizedName) return p;
    }
    // Try substring
    for (const p of this.allProducts) {
      const nameNorm = this.normalize(p.name);
      if (nameNorm.includes(normalizedName) || normalizedName.includes(nameNorm)) return p;
    }
    return null;
  }

  private extractProducts(message: string): Array<{ product: any; quantity: number; alias: string; ambiguous?: boolean; options?: any[]; variant_id?: string; modifiers?: Array<{ modifier_id: string; option_id: string; option_name: string; price_add: number }>; price?: number }> {
    const results: Array<{ product: any; quantity: number; alias: string; ambiguous?: boolean; options?: any[]; variant_id?: string; modifiers?: Array<{ modifier_id: string; option_id: string; option_name: string; price_add: number }>; price?: number }> = [];
    const consumedRanges: Array<[number, number]> = [];

    // 1. Try variant aliases first (longest, most specific: "calabresa grande")
    const sortedVariants = Object.entries(this.variantAliases)
      .sort((a, b) => b[0].length - a[0].length);

    for (const [variantAlias, data] of sortedVariants) {
      const idx = message.indexOf(variantAlias);
      if (idx === -1) continue;

      const rangeEnd = idx + variantAlias.length;
      const overlaps = consumedRanges.some(([start, end]) =>
        (idx >= start && idx < end) || (rangeEnd > start && rangeEnd <= end) || (idx <= start && rangeEnd >= end)
      );
      if (overlaps) continue;

      const before = message.substring(0, idx).trim();
      const quantity = this.extractQuantity(before);

      results.push({
        product: data.product,
        quantity,
        alias: variantAlias,
        variant_id: data.variant.id,
      });

      consumedRanges.push([idx, rangeEnd]);
    }

    // 2. Merge DB aliases with static aliases, sort by length (longest first)
    const allAliases = { ...this.dbAliases, ...PRODUCT_ALIASES };
    const sortedAliases = Object.entries(allAliases)
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

    // If no alias matched, try direct product name matching
    if (results.length === 0) {
      // Try matching the full message (or message without quantity prefix) as a product name substring
      const messageNorm = message.replace(/^\d+\s*x?\s*/, '').trim();
      const directMatches = this.allProducts.filter((p: any) => {
        const nameNorm = this.normalize(p.name);
        return nameNorm.includes(messageNorm) || messageNorm.includes(nameNorm);
      });

      if (directMatches.length === 1) {
        const before = message.replace(messageNorm, '').trim();
        const quantity = this.extractQuantity(before);
        results.push({
          product: directMatches[0],
          quantity,
          alias: messageNorm,
        });
        matchedProductIds.add(directMatches[0].id);
      } else if (directMatches.length > 1) {
        // Multiple products match — ambiguous
        // Pick the shortest name (most specific match)
        directMatches.sort((a: any, b: any) => this.normalize(a.name).length - this.normalize(b.name).length);
        const best = directMatches[0];
        const before = message.replace(messageNorm, '').trim();
        const quantity = this.extractQuantity(before);
        results.push({
          product: best,
          quantity,
          alias: messageNorm,
        });
        matchedProductIds.add(best.id);
      }
    }

    // If still no match, try modifier option aliases (flavors from creates_splits modifiers)
    if (results.length === 0) {
      const words = message.split(' ').filter(w => w.length >= 2);
      for (const word of words) {
        const match = this.modifierOptionAliases[word];
        if (match && !matchedProductIds.has(match.product.id)) {
          const idx = message.indexOf(word);
          const before = idx > 0 ? message.substring(0, idx).trim() : '';
          const quantity = this.extractQuantity(before);

          // Include the modifier selection
          const price = match.product.promo_price ?? match.product.price;

          results.push({
            product: match.product,
            quantity,
            alias: word,
            modifiers: [{
              modifier_id: match.modifier.id,
              option_id: match.option.id,
              option_name: match.option.name,
              price_add: match.option.price_add,
            }],
            price: price + match.option.price_add,
          });
          matchedProductIds.add(match.product.id);
          break; // single product match
        }
      }
    }

    // If still no match, try fuzzy matching on words
    if (results.length === 0) {
      const words = message.split(' ').filter(w => w.length >= 3);

      for (const word of words) {
        if (matchedProductIds.has(word)) continue;

        // Fuzzy match against all aliases
        let bestAlias: string | null = null;
        let bestProduct: any = null;
        let bestDist = 3; // max distance for 3-5 char words

        for (const [alias, productName] of Object.entries(allAliases)) {
          const dist = this.levenshtein(word, this.normalize(alias));
          // Scale threshold by word length: longer words allow more distance
          const threshold = word.length <= 4 ? 1 : word.length <= 6 ? 2 : 3;
          if (dist < bestDist && dist <= threshold) {
            bestDist = dist;
            bestAlias = alias;
            const candidates = this.allProducts.filter((p: any) =>
              this.normalize(p.name) === this.normalize(productName)
            );
            if (candidates.length > 0) bestProduct = candidates[0];
          }
        }

        // Also fuzzy match against product names directly
        for (const p of this.allProducts) {
          const nameWords = this.normalize(p.name).split(' ');
          for (const nw of nameWords) {
            const dist = this.levenshtein(word, nw);
            const threshold = word.length <= 4 ? 1 : 2;
            if (dist < bestDist && dist <= threshold) {
              bestDist = dist;
              bestProduct = p;
              bestAlias = word;
            }
          }
        }

        if (bestProduct && !matchedProductIds.has(bestProduct.id)) {
          // Extract quantity from before the word
          const idx = message.indexOf(word);
          const before = idx > 0 ? message.substring(0, idx).trim() : '';
          const quantity = this.extractQuantity(before);

          results.push({
            product: bestProduct,
            quantity,
            alias: bestAlias || word,
          });
          matchedProductIds.add(bestProduct.id);
        }
      }
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

    lines.push('📋 *Pedido:*\n');
    for (const item of items) {
      lines.push(`• ${item.quantity}x ${item.name} - R$ ${item.total.toFixed(2)}`);
    }

    const deliveryFee = settingsAgent.getDeliveryFee();
    const minOrder = settingsAgent.getMinOrder();

    lines.push(`\n💰 Subtotal: R$ ${subtotal.toFixed(2)}`);
    if (deliveryFee > 0) {
      lines.push(`🛵 Taxa de entrega: R$ ${deliveryFee.toFixed(2)}`);
      lines.push(`💰 *Total: R$ ${(subtotal + deliveryFee).toFixed(2)}*`);
    } else {
      lines.push(`💰 *Total: R$ ${subtotal.toFixed(2)}*`);
    }

    if (minOrder > 0 && subtotal < minOrder) {
      lines.push(`\n⚠️ Pedido mínimo: R$ ${minOrder.toFixed(2)} (falta R$ ${(minOrder - subtotal).toFixed(2)})`);
    }

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

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  private matchCategory(message: string): { category: string; products: string[] } | null {
    // Merge DB category suggestions with static ones
    const allSuggestions = { ...this.dbCategorySuggestions, ...CATEGORY_SUGGESTIONS };
    for (const [cat, products] of Object.entries(allSuggestions)) {
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
      const allSuggestions = { ...this.dbCategorySuggestions, ...CATEGORY_SUGGESTIONS };
      const catData = allSuggestions[category];
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
    const allSuggestions = { ...this.dbCategorySuggestions, ...CATEGORY_SUGGESTIONS };
    for (const msg of recent) {
      const content = this.normalize(msg.content || '');
      for (const cat of Object.keys(allSuggestions)) {
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
        return 'Desculpe, não entendi. 😅\n\nDigite o que deseja pedir!';
    }
  }
}

export const nlpService = new NLPService();
