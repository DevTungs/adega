import { whatsappSessionService, SessionState } from './whatsapp.service';
import { messageFormatter } from './whatsapp.formatter';
import { nlpService } from '../../services/nlp/nlp.service';
import { aiService } from '../../services/ai/ai.service';
import { productsService } from '../products/products.service';
import { customersService } from '../customers/customers.service';
import { ordersService } from '../orders/orders.service';
import { licenseService } from '../license/license.service';
import { settingsAgent } from '../../services/settings/settings.service';
import { orderValidator } from '../../services/order-validator/order-validator.service';
import { AppError } from '../../shared/errors/app-error';
import { emitAgentRequest, emitPixPending } from '../../services/websocket/ws.server';
import { logger } from '../../shared/middlewares/logger';
import { normalizePhone } from '../../shared/utils/phone';
import { config } from '../../config/app.config';

const BOT_MODE = config.botMode;
logger.info({ mode: BOT_MODE }, '[HANDLER] Bot mode configured');

function buildPaymentMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const methods = settingsAgent.getPaymentMethods();
  for (const m of methods) {
    map[m.icon] = m.id;
    map[m.label.toLowerCase()] = m.id;
    map[m.id] = m.id;
    // Portuguese aliases
    if (m.id === 'cash') { map['dinheiro'] = 'cash'; }
    if (m.id === 'credit_card') { map['crédito'] = 'credit_card'; map['credito'] = 'credit_card'; map['cartão'] = 'credit_card'; map['cartao'] = 'credit_card'; }
    if (m.id === 'debit_card') { map['débito'] = 'debit_card'; map['debito'] = 'debit_card'; }
    if (m.id === 'pix') { map['pix'] = 'pix'; }
    if (m.id === 'voucher') { map['vale'] = 'voucher'; map['voucher'] = 'voucher'; }
  }
  return map;
}

type HandlerResponse = string | {
  _type: 'buttons';
  text: string;
  buttons: Array<{ id: string; text: string }>;
} | {
  _type: 'list';
  title: string;
  description: string;
  buttonText: string;
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
} | null;

function buttons(text: string, ...btns: Array<{ id: string; text: string }>): HandlerResponse {
  return { _type: 'buttons', text, buttons: btns };
}

function list(title: string, description: string, buttonText: string, sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>): HandlerResponse {
  return { _type: 'list', title, description, buttonText, sections };
}

function paymentList(): HandlerResponse {
  const methods = settingsAgent.getPaymentMethods();
  if (methods.length === 0) {
    return buttons(
      'Qual a forma de pagamento? 💳',
      { id: 'dinheiro', text: '💰 Dinheiro' },
      { id: 'credito', text: '💳 Crédito' },
      { id: 'debito', text: '💳 Débito' },
      { id: 'pix', text: '📱 PIX' },
      { id: 'vale', text: '🎫 Vale' },
    );
  }
  return buttons(
    'Qual a forma de pagamento? 💳',
    ...methods.map(m => ({ id: m.id, text: `${m.icon} ${m.label}` })),
  );
}

export class WhatsAppHandler {
  private isConfirmation(message: string): boolean {
    const exact = ['sim', 's', 'ok', 'pode', 'fechou', 'confirmo', 'confirma'];
    if (exact.includes(message)) return true;
    // Fuzzy match for "confirmar" (tolerate 1-2 typos)
    if (message.length >= 5 && message.length <= 12) {
      const target = 'confirmar';
      let diffs = 0;
      const minLen = Math.min(message.length, target.length);
      for (let i = 0; i < minLen; i++) {
        if (message[i] !== target[i]) diffs++;
      }
      diffs += Math.abs(message.length - target.length);
      if (diffs <= 2) return true;
    }
    return false;
  }
  async handleMessage(phone: string, message: string, senderName?: string, whatsappJid?: string): Promise<HandlerResponse> {
    // Block all bot activity when license is invalid
    const licenseStatus = await licenseService.validateCurrent(false);
    if (!licenseStatus.canCreateOrders) {
      return '⚠️ Sistema indisponível no momento. Entre em contato diretamente com o estabelecimento.';
    }

    const normalizedPhone = normalizePhone(phone);
    const session = await whatsappSessionService.getOrCreate(normalizedPhone);
    const normalized = message.toLowerCase().trim();

    logger.info({ phone: normalizedPhone, state: session.state, message }, '[HANDLER] Processing message');

    // Handle based on session state
    switch (session.state) {
      case 'agent_active':
        // Bot is paused - human agent is handling the conversation
        return null;
      case 'idle':
        return this.handleIdle(normalizedPhone, normalized, session, senderName);
      case 'awaiting_items':
        return this.handleItemsInput(normalizedPhone, normalized, session);
      case 'awaiting_variant':
        return this.handleVariantInput(normalizedPhone, normalized, session);
      case 'awaiting_modifier':
        return this.handleModifierInput(normalizedPhone, normalized, session);
      case 'awaiting_confirmation':
        return this.handleConfirmation(normalizedPhone, normalized, session);
      case 'awaiting_name':
        return this.handleNameInput(normalizedPhone, normalized, session, whatsappJid);
      case 'awaiting_address':
        return this.handleAddressInput(normalizedPhone, normalized, session);
      case 'awaiting_payment':
        return this.handlePaymentInput(normalizedPhone, normalized, session);
      case 'awaiting_notes':
        return this.handleNotesInput(normalizedPhone, normalized, session);
      case 'awaiting_pix_confirmation':
        return this.handlePixConfirmation(normalizedPhone, normalized, session);
      case 'awaiting_cancel':
        return this.handleAwaitingCancel(normalizedPhone, normalized, session);
      case 'order_placed':
        return this.handleOrderPlaced(normalizedPhone, normalized, session);
      default:
        await whatsappSessionService.resetSession(normalizedPhone);
        return this.handleIdle(normalizedPhone, normalized, session, senderName);
    }
  }

  private async handleIdle(phone: string, message: string, session: any, senderName?: string): Promise<HandlerResponse> {
    const displayName = senderName || 'cliente';

    // Greetings
    const greetings = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi', 'hey', 'eai', 'e ai', 'opa', 'fala'];
    if (greetings.some(g => message.startsWith(g))) {
      return buttons(
        `Olá, ${displayName}! 👋\n\nComo posso ajudar?`,
        { id: 'cardapio', text: '📋 Cardápio' },
        { id: 'pedido', text: '🛒 Pedido' },
        { id: 'acompanhar', text: '📦 Acompanhar' },
        { id: 'atendente', text: '👤 Atendente' },
      );
    }

    if (message === '1' || ['cardapio', 'cardápio', 'menu', 'produtos'].includes(message)) {
      const catalog = await productsService.getCatalog();
      return messageFormatter.catalog(catalog);
    }

    // "sim" in idle state — show catalog (response to stock warning, etc.)
    if (['sim', 's'].includes(message)) {
      const catalog = await productsService.getCatalog();
      return messageFormatter.catalog(catalog) + '\n\nDigite os itens que deseja! Digite o nome dos produtos';
    }

    if (message === '2' || ['pedido', 'fazer pedido', 'pedir', 'quero pedir'].includes(message)) {
      const catalog = await productsService.getCatalog();
      return messageFormatter.catalog(catalog) + '\n\nDigite os itens que deseja! Digite o nome dos produtos';
    }

    if (message === '3' || ['meu pedido', 'status', 'acompanhar'].includes(message)) {
      const context = JSON.parse(session.context || '{}');
      if (context.lastOrderId) {
        const order = await ordersService.getById(context.lastOrderId);
        return messageFormatter.statusUpdate(order.order_number, order.status);
      }
      // Fallback: look up active orders by customer
      if (session.customer_id) {
        const activeOrders = await ordersService.getActiveByCustomer(session.customer_id);
        if (activeOrders.length > 0) {
          const order = activeOrders[0];
          return messageFormatter.statusUpdate(order.order_number, order.status);
        }
      }
      return 'Você não tem pedidos ativos no momento. 🛒';
    }

    if (message === '4' || ['atendente', 'humano', 'pessoa', 'falar com alguém'].includes(message)) {
      logger.info({ phone, message }, '[HANDLER] Agent request from idle state');
      await whatsappSessionService.updateState(phone, 'agent_active' as SessionState, {
        ...JSON.parse(session.context || '{}'),
        agentStartedAt: new Date().toISOString(),
      });
      emitAgentRequest(phone, displayName);
      return 'Estamos conectando você com um atendente. Aguarde um momento! 🙏';
    }


    if (['ajuda', 'help'].includes(message)) {
      return messageFormatter.help();
    }

    // Handle cancel when there's no active order
    if (['cancelar', 'cancela', 'cancel'].includes(message)) {
      return 'Você não tem um pedido ativo no momento. 🛒';
    }

    // Interpret message using configured mode (AI or NLP)
    try {
      const response = BOT_MODE === 'nlp'
        ? await nlpService.parseMessage(message, session)
        : await aiService.interpretMessage(message, session);

      switch (response.intent) {
        case 'novo_pedido':
          // Check if products need variant selection (valid: false)
          const pendingVariant = response.products.find((p: any) => p.valid === false) as any;
          if (pendingVariant) {
            const context = JSON.parse(session.context || '{}');
            return this.processPendingVariant(phone, pendingVariant, response.products, session, message, context.items || []);
          }

          // Response has products — save to session
          if (response.products.length > 0) {
            await whatsappSessionService.updateState(phone, 'awaiting_items', {
              items: response.products.map((p: any) => ({
                product_id: p.product_id,
                name: p.name,
                quantity: p.quantity,
                price: p.price,
                variant_id: p.variant_id,
                halves: p.halves,
                modifiers: p.modifiers,
              })),
              history: [
                ...(JSON.parse(session.context || '{}').history || []).slice(-4),
                { role: 'user', content: message },
                { role: 'assistant', content: response.message },
              ],
            });
            return buttons(
              response.message,
              { id: 'sim', text: '✅ Confirmar' },
              { id: 'adicionar', text: '➕ Adicionar mais' },
              { id: 'nao', text: '❌ Cancelar' },
            );
          }

          // Fallback: try direct product name matching
          const directMatch = await this.matchProductDirectly(message);
          if (directMatch) {
            const displayItems = [{
              name: directMatch.name,
              quantity: directMatch.quantity,
              price: directMatch.price,
              total: directMatch.price * directMatch.quantity,
            }];
            const subtotal = displayItems[0].total;
            const summary = `📋 *Pedido:*\n\n• ${directMatch.quantity}x ${directMatch.name} - R$ ${subtotal.toFixed(2)}\n\n💰 *Total: R$ ${subtotal.toFixed(2)}*`;

            await whatsappSessionService.updateState(phone, 'awaiting_items', {
              items: [directMatch],
              history: [
                ...(JSON.parse(session.context || '{}').history || []).slice(-4),
                { role: 'user', content: message },
                { role: 'assistant', content: summary },
              ],
            });
            return buttons(
              summary,
              { id: 'sim', text: '✅ Confirmar' },
              { id: 'adicionar', text: '➕ Adicionar mais' },
            );
          }

          // No products but has message (disambiguation, category options, etc.)
          if (response.message) {
            await this.saveHistory(phone, session, message, response.message);
            return response.message;
          }
          return 'Não consegui identificar os itens. Pode repetir? Digite o nome dos produtos.';

        case 'cardapio':
          const catalog = await productsService.getCatalog();
          return messageFormatter.catalog(catalog);


        case 'ajuda':
          return messageFormatter.help();

        case 'outro':
          await this.saveHistory(phone, session, message, response.message);
          return response.message;

        default:
          const defaultMsg = response.message || `Desculpe, não entendi. Digite *ajuda* para ver as opções.`;
          await this.saveHistory(phone, session, message, defaultMsg);
          return defaultMsg;
      }
    } catch (err: any) {
      logger.error({ error: err.message, mode: BOT_MODE }, 'Message interpretation error');
      return buttons(
        'Desculpe, não entendi.',
        { id: 'cardapio', text: '📋 Cardápio' },
        { id: 'pedido', text: '🛒 Pedido' },
        { id: 'acompanhar', text: '📦 Acompanhar' },
        { id: 'atendente', text: '👤 Atendente' },
      );
    }
  }

  private async handleItemsInput(phone: string, message: string, session: any): Promise<HandlerResponse> {
    const context = JSON.parse(session.context || '{}');

    // Check if adding more items
    if (['mais', 'adicionar', 'add', '+'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'idle', context);
      return 'O que mais deseja adicionar? 🛒';
    }

    // Check if confirming (with fuzzy tolerance)
    // But NOT if there's a stock warning — "sim" means "show options", not "confirm"
    if (this.isConfirmation(message) && !context.stockWarning) {
      // Validate minimum order before proceeding
      const minOrderError = this.checkMinimumOrder(context.items);
      if (minOrderError) return minOrderError;
      await whatsappSessionService.updateState(phone, 'awaiting_name', context);
      return messageFormatter.askName();
    }

    // "sim" after stock warning → show catalog
    if (this.isConfirmation(message) && context.stockWarning) {
      delete context.stockWarning;
      await whatsappSessionService.updateState(phone, 'idle', context);
      const catalog = await productsService.getCatalog();
      return messageFormatter.catalog(catalog) + '\n\nDigite os itens que deseja! Digite o nome dos produtos';
    }

    // Check if wants to cancel — ask first
    if (['não', 'nao', 'n', 'cancelar', 'cancela', 'cancel'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'awaiting_cancel', context);
      return buttons(
        'Deseja adicionar mais itens ou cancelar o pedido?',
        { id: 'adicionar', text: '➕ Adicionar mais' },
        { id: 'cancelar', text: '❌ Cancelar pedido' },
      );
    }

    // Interpret message using configured mode
    const aiResponse = BOT_MODE === 'nlp'
      ? await nlpService.parseMessage(message, session)
      : await aiService.interpretMessage(message, session);

    // Check if response has stock warning
    const hasStockWarning = aiResponse.message && aiResponse.message.includes('Sem estoque');

    // Check if products need variant selection (valid: false)
    const pendingVariant = aiResponse.products.find((p: any) => p.valid === false) as any;
    if (pendingVariant) {
      return this.processPendingVariant(phone, pendingVariant, aiResponse.products, session, message, context.items || []);
    }

    // NLP/AI returned products — update session
    if (aiResponse.products.length > 0) {
      const newContext: any = {
        items: aiResponse.products.map((p: any) => ({
          product_id: p.product_id,
          name: p.name,
          quantity: p.quantity,
          price: p.price,
          variant_id: p.variant_id,
          halves: p.halves,
          modifiers: p.modifiers,
        })),
        history: context.history,
      };
      if (hasStockWarning) {
        newContext.stockWarning = true;
        await whatsappSessionService.updateState(phone, 'awaiting_items', newContext);
        return aiResponse.message;
      }
      await whatsappSessionService.updateState(phone, 'awaiting_items', newContext);
      return buttons(
        aiResponse.message,
        { id: 'sim', text: '✅ Confirmar' },
        { id: 'adicionar', text: '➕ Adicionar mais' },
        { id: 'nao', text: '❌ Cancelar' },
      );
    }

    // Fallback: if AI/NLP returned no products, try direct product name matching
    // BUT skip if the message is a removal intent (NLP already handled it)
    const removalWords = ['remover', 'remove', 'tirar', 'tira', 'retirar', 'retira', 'excluir', 'deletar'];
    const isRemovalMsg = removalWords.some(w => message.startsWith(w) || message.includes(`tira `) || message.includes(`remove `));
    if (!isRemovalMsg && aiResponse.products.length === 0) {
      const directMatch = await this.matchProductDirectly(message);
      if (directMatch) {
        const existingItems = context.items || [];
        const merged = this.mergeItemsLocal(existingItems, [directMatch]);
        const displayItems = merged.map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          total: i.price * i.quantity,
        }));
        const subtotal = displayItems.reduce((sum: number, i: any) => sum + i.total, 0);

        const summary = [`📋 *Pedido:*\n`];
        for (const item of displayItems) {
          summary.push(`• ${item.quantity}x ${item.name} - R$ ${item.total.toFixed(2)}`);
        }
        summary.push(`\n💰 *Total: R$ ${subtotal.toFixed(2)}*`);

        await whatsappSessionService.updateState(phone, 'awaiting_items', {
          items: merged,
          history: context.history,
        });
        return buttons(
          summary.join('\n'),
          { id: 'sim', text: '✅ Confirmar' },
          { id: 'adicionar', text: '➕ Adicionar mais' },
        );
      }
    }

    // NLP/AI returned a message (disambiguation, category options, stock warning, etc.)
    if (aiResponse.message) {
      if (hasStockWarning) {
        // Save stock warning flag so "sim" shows catalog instead of confirming
        context.stockWarning = true;
        await whatsappSessionService.updateState(phone, 'awaiting_items', context);
      }
      return aiResponse.message;
    }

    return buttons(
      'O que deseja fazer com o pedido?',
      { id: 'sim', text: '✅ Confirmar' },
      { id: 'adicionar', text: '➕ Adicionar mais' },
      { id: 'nao', text: '❌ Cancelar' },
    );
  }

  private async handleConfirmation(phone: string, message: string, session: any): Promise<HandlerResponse> {
    if (this.isConfirmation(message)) {
      const context = JSON.parse(session.context || '{}');
      // Validate minimum order before proceeding
      const minOrderError = this.checkMinimumOrder(context.items);
      if (minOrderError) return minOrderError;
      await whatsappSessionService.updateState(phone, 'awaiting_name', context);
      return messageFormatter.askName() + '\n\nDigite seu nome.';
    }

    if (['não', 'nao', 'n'].includes(message)) {
      const context = JSON.parse(session.context || '{}');
      await whatsappSessionService.updateState(phone, 'awaiting_cancel', context);
      return buttons(
        'Deseja adicionar mais itens ou cancelar o pedido?',
        { id: 'adicionar', text: '➕ Adicionar mais' },
        { id: 'cancelar', text: '❌ Cancelar pedido' },
      );
    }

    return buttons(
      'Confirma o pedido?',
      { id: 'sim', text: '✅ Confirmar' },
      { id: 'nao', text: '❌ Cancelar' },
    );
  }

  private async handleAwaitingCancel(phone: string, message: string, session: any): Promise<HandlerResponse> {
    const context = JSON.parse(session.context || '{}');

    if (['adicionar', 'add', 'mais', 'voltar', 'continuar'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'awaiting_items', context);
      return 'O que mais deseja adicionar? 🛒';
    }

    if (['cancelar', 'cancela', 'cancel', 'sair'].includes(message)) {
      await whatsappSessionService.resetSession(phone);
      return messageFormatter.cancelConfirmation();
    }

    return buttons(
      'O que deseja fazer?',
      { id: 'adicionar', text: '➕ Adicionar mais' },
      { id: 'cancelar', text: '❌ Cancelar pedido' },
    );
  }

  private async handleVariantInput(phone: string, message: string, session: any): Promise<HandlerResponse> {
    const context = JSON.parse(session.context || '{}');
    const pendingItem = context.pendingItem;
    if (!pendingItem) {
      await whatsappSessionService.updateState(phone, 'awaiting_items', {});
      return 'Não entendi. Pode repetir seu pedido?';
    }

    const product = pendingItem.product;
    if (!product || !product.variants) {
      // No variants needed anymore, go back to items
      await whatsappSessionService.updateState(phone, 'awaiting_items', context);
      return 'Pode continuar seu pedido. O que mais deseja?';
    }

    // Allow cancel/back
    if (['cancelar', 'cancela', 'cancel', 'não', 'nao', 'n'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'awaiting_cancel', context);
      return buttons(
        'Deseja cancelar o pedido?',
        { id: 'adicionar', text: '➕ Adicionar mais' },
        { id: 'cancelar', text: '❌ Cancelar pedido' },
      );
    }
    if (['voltar', 'volta', 'back', 'menu'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'awaiting_items', { items: context.items || [] });
      return 'OK, voltando ao pedido. O que mais deseja?';
    }

    // Try to match the user's message to a variant
    const normalizedMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const matchedVariant = product.variants.find((v: any) => {
      const vNorm = v.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      return vNorm.includes(normalizedMessage) || normalizedMessage.includes(vNorm);
    });

    if (!matchedVariant) {
      const activeVariants = product.variants.filter((v: any) => v.is_active);
      return buttons(
        `Para *${product.name}*, qual tamanho você quer?`,
        ...activeVariants.map((v: any) => ({
          id: v.name.toLowerCase(),
          text: `${v.name} - R$ ${(v.promo_price || v.price).toFixed(2)}`,
        })),
      );
    }

    const itemWithVariant = {
      ...context.pendingItem,
      variant_id: matchedVariant.id,
      name: pendingItem.halves
        ? pendingItem.name.replace(product.name, `${product.name} ${matchedVariant.name}`)
        : `${product.name} ${matchedVariant.name}`,
      price: matchedVariant.promo_price || matchedVariant.price,
    };

    if (pendingItem.halves) {
      if (pendingItem.modifiers) {
        itemWithVariant.price += pendingItem.modifiers.reduce((s: number, m: any) => s + (m.price_add || 0), 0);
      }
      const items = context.items || [];
      items.push(itemWithVariant);
      context.items = items;
      delete context.pendingItem;
      await whatsappSessionService.updateState(phone, 'awaiting_items', context);
      const displayItems = items.map((i: any) => `• ${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2)}`).join('\n');
      const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
      return buttons(
        `📋 *Pedido:*\n${displayItems}\n\n💰 *Total: R$ ${subtotal.toFixed(2)}*`,
        { id: 'sim', text: '✅ Confirmar' },
        { id: 'adicionar', text: '➕ Adicionar mais' },
      );
    }

    const requiredMods = (product.modifiers || []).filter((m: any) => m.type === 'required');
    if (requiredMods.length > 0 && (!pendingItem.modifiers || pendingItem.modifiers.length === 0)) {
      context.pendingItem = itemWithVariant;
      context.pendingModifierIndex = 0;
      await whatsappSessionService.updateState(phone, 'awaiting_modifier' as SessionState, context);

      const firstMod = requiredMods[0];
      const activeOpts = (firstMod.options || []).filter((o: any) => o.is_active);
      return buttons(
        `Escolha *${firstMod.name}*:`,
        ...activeOpts.map((o: any) => ({
          id: o.name.toLowerCase(),
          text: `${o.name}${o.price_add > 0 ? ` (+R$${o.price_add.toFixed(2)})` : ''}`,
        })),
      );
    }

    if (pendingItem.modifiers && pendingItem.modifiers.length > 0) {
      const flavorNames = pendingItem.modifiers.map((m: any) => m.option_name).join(', ');
      itemWithVariant.name = `${itemWithVariant.name} - ${flavorNames}`;
      itemWithVariant.price += pendingItem.modifiers.reduce((s: number, m: any) => s + (m.price_add || 0), 0);
    }

    const items = context.items || [];
    items.push(itemWithVariant);
    context.items = items;
    delete context.pendingItem;
    await whatsappSessionService.updateState(phone, 'awaiting_items', context);

    const displayItems = items.map((i: any) => `• ${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2)}`).join('\n');
    const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);

    return buttons(
      `📋 *Pedido:*\n${displayItems}\n\n💰 *Total: R$ ${subtotal.toFixed(2)}*`,
      { id: 'sim', text: '✅ Confirmar' },
      { id: 'adicionar', text: '➕ Adicionar mais' },
    );
  }

  private async handleModifierInput(phone: string, message: string, session: any): Promise<HandlerResponse> {
    const context = JSON.parse(session.context || '{}');
    const pendingItem = context.pendingItem;
    const modIndex = context.pendingModifierIndex ?? 0;

    if (!pendingItem || !pendingItem.product) {
      await whatsappSessionService.updateState(phone, 'awaiting_items', {});
      return 'Não entendi. Pode repetir seu pedido?';
    }

    // Allow cancel/back
    if (['cancelar', 'cancela', 'cancel', 'não', 'nao', 'n'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'awaiting_cancel', context);
      return buttons(
        'Deseja cancelar o pedido?',
        { id: 'adicionar', text: '➕ Adicionar mais' },
        { id: 'cancelar', text: '❌ Cancelar pedido' },
      );
    }
    if (['voltar', 'volta', 'back', 'menu'].includes(message)) {
      // Go back to variant selection
      delete context.pendingModifierIndex;
      await whatsappSessionService.updateState(phone, 'awaiting_variant' as SessionState, context);
      const product = pendingItem.product;
      const activeVariants = (product.variants || []).filter((v: any) => v.is_active);
      return buttons(
        `Para *${product.name}*, qual tamanho você quer?`,
        ...activeVariants.map((v: any) => ({
          id: v.name.toLowerCase(),
          text: `${v.name} - R$ ${(v.promo_price || v.price).toFixed(2)}`,
        })),
      );
    }

    const product = pendingItem.product;
    const requiredMods = (product.modifiers || []).filter((m: any) => m.type === 'required');

    if (modIndex >= requiredMods.length) {
      const items = context.items || [];
      items.push(pendingItem);
      context.items = items;
      delete context.pendingItem;
      delete context.pendingModifierIndex;
      delete context.pendingModifierSelectionCount;
      await whatsappSessionService.updateState(phone, 'awaiting_items', context);

      const displayItems = items.map((i: any) => `• ${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2)}`).join('\n');
      const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
      return buttons(
        `📋 *Pedido:*\n${displayItems}\n\n💰 *Total: R$ ${subtotal.toFixed(2)}*`,
        { id: 'sim', text: '✅ Confirmar' },
        { id: 'adicionar', text: '➕ Adicionar mais' },
      );
    }

    const currentMod = requiredMods[modIndex];
    const opts = (currentMod.options || []).filter((o: any) => o.is_active);
    const maxSelect = currentMod.max_select || 1;
    const selectionCount = context.pendingModifierSelectionCount || 0;

    const normalizedMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const isConfirm = this.isConfirmation(normalizedMessage) || ['inteira', 'inteiro', 'confirmar sabor', 'chega', 'pronto'].includes(normalizedMessage);

    if (isConfirm && selectionCount >= (currentMod.min_select || 1)) {
      context.pendingModifierIndex = modIndex + 1;
      delete context.pendingModifierSelectionCount;
      context.pendingItem = pendingItem;
      await whatsappSessionService.updateState(phone, 'awaiting_modifier' as SessionState, context);

      if (context.pendingModifierIndex < requiredMods.length) {
        const nextMod = requiredMods[context.pendingModifierIndex];
        const activeOpts = (nextMod.options || []).filter((o: any) => o.is_active);
        return buttons(
          `Agora escolha *${nextMod.name}*:`,
          ...activeOpts.map((o: any) => ({
            id: o.name.toLowerCase(),
            text: `${o.name}${o.price_add > 0 ? ` (+R$${o.price_add.toFixed(2)})` : ''}`,
          })),
        );
      }

      const items = context.items || [];
      items.push(pendingItem);
      context.items = items;
      delete context.pendingItem;
      delete context.pendingModifierIndex;
      delete context.pendingModifierSelectionCount;
      await whatsappSessionService.updateState(phone, 'awaiting_items', context);

      const displayItems = items.map((i: any) => `• ${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2)}`).join('\n');
      const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
      return buttons(
        `📋 *Pedido:*\n${displayItems}\n\n💰 *Total: R$ ${subtotal.toFixed(2)}*`,
        { id: 'sim', text: '✅ Confirmar' },
        { id: 'adicionar', text: '➕ Adicionar mais' },
      );
    }

    const matchedOption = opts.find((o: any, i: number) => {
      const oNorm = o.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      return oNorm.includes(normalizedMessage) || normalizedMessage.includes(oNorm) || normalizedMessage === String(i + 1);
    });

    if (!matchedOption) {
      return buttons(
        `Opção inválida. Escolha *${currentMod.name}*:`,
        ...opts.map((o: any) => ({
          id: o.name.toLowerCase(),
          text: `${o.name}${o.price_add > 0 ? ` (+R$${o.price_add.toFixed(2)})` : ''}`,
        })),
      );
    }

    if (!pendingItem.modifiers) pendingItem.modifiers = [];
    pendingItem.modifiers.push({
      modifier_id: currentMod.id,
      option_id: matchedOption.id,
      option_name: matchedOption.name,
      price_add: matchedOption.price_add,
    });
    pendingItem.price += matchedOption.price_add;

    const flavorNames = pendingItem.modifiers.map((m: any) => m.option_name).join(' + ');
    const baseName = pendingItem.name.split(' - ')[0];
    pendingItem.name = `${baseName} - ${flavorNames}`;

    const newSelectionCount = selectionCount + 1;

    if (newSelectionCount < maxSelect) {
      context.pendingModifierSelectionCount = newSelectionCount;
      context.pendingItem = pendingItem;
      await whatsappSessionService.updateState(phone, 'awaiting_modifier' as SessionState, context);

      return buttons(
        `Escolha o segundo sabor para *meia* ou confirme para pizza inteira:`,
        ...opts.map((o: any) => ({
          id: o.name.toLowerCase(),
          text: `${o.name}${o.price_add > 0 ? ` (+R$${o.price_add.toFixed(2)})` : ''}`,
        })),
        { id: 'confirmar', text: '✅ Pizza inteira' },
      );
    }

    context.pendingModifierIndex = modIndex + 1;
    delete context.pendingModifierSelectionCount;
    context.pendingItem = pendingItem;
    await whatsappSessionService.updateState(phone, 'awaiting_modifier' as SessionState, context);

    if (context.pendingModifierIndex < requiredMods.length) {
      const nextMod = requiredMods[context.pendingModifierIndex];
      const activeOpts = (nextMod.options || []).filter((o: any) => o.is_active);
      return buttons(
        `Agora escolha *${nextMod.name}*:`,
        ...activeOpts.map((o: any) => ({
          id: o.name.toLowerCase(),
          text: `${o.name}${o.price_add > 0 ? ` (+R$${o.price_add.toFixed(2)})` : ''}`,
        })),
      );
    }

    const items = context.items || [];
    items.push(pendingItem);
    context.items = items;
    delete context.pendingItem;
    delete context.pendingModifierIndex;
    delete context.pendingModifierSelectionCount;
    await whatsappSessionService.updateState(phone, 'awaiting_items', context);

    const displayItems = items.map((i: any) => `• ${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2)}`).join('\n');
    const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    return buttons(
      `📋 *Pedido:*\n${displayItems}\n\n💰 *Total: R$ ${subtotal.toFixed(2)}*`,
      { id: 'sim', text: '✅ Confirmar' },
      { id: 'adicionar', text: '➕ Adicionar mais' },
    );
  }

  private async handleNameInput(phone: string, message: string, session: any, whatsappJid?: string): Promise<HandlerResponse> {
    if (['não', 'nao', 'cancelar'].includes(message)) {
      await whatsappSessionService.resetSession(phone);
      return messageFormatter.cancelConfirmation();
    }

    const context = JSON.parse(session.context || '{}');
    context.customerName = message;

    // Get or create customer
    const customer = await customersService.getOrCreateByPhone(phone);
    await customersService.update(customer.id, { name: message, whatsapp_jid: whatsappJid || null });
    await whatsappSessionService.setCustomer(phone, customer.id);

    await whatsappSessionService.updateState(phone, 'awaiting_address', context);

    // Check if customer has a previous address
    const addresses = JSON.parse(customer.addresses || '[]');
    if (addresses.length > 0) {
      const lastAddress = addresses[addresses.length - 1];
      return buttons(
        `📍 *Endereço de Entrega*\n\nÚltimo endereço: ${lastAddress}`,
        { id: 'sim', text: '✅ Sim, esse mesmo' },
        { id: 'novo_endereco', text: '✏️ Digitar novo endereço' },
      );
    }
    return messageFormatter.askAddress();
  }

  private async handleAddressInput(phone: string, message: string, session: any): Promise<HandlerResponse> {
    // "novo_endereco" from the address confirmation buttons — ask for new address
    if (message === 'novo_endereco') {
      return messageFormatter.askAddress() + '\n\nDigite seu endereço completo.';
    }

    if (['não', 'nao', 'cancelar'].includes(message)) {
      await whatsappSessionService.resetSession(phone);
      return messageFormatter.cancelConfirmation();
    }

    // Handle "use last address"
    if (['sim', 's', 'usar', 'mesmo'].includes(message)) {
      const customer = await customersService.getByPhone(phone);
      if (customer) {
        const addresses = JSON.parse(customer.addresses || '[]');
        if (addresses.length > 0) {
          const context = JSON.parse(session.context || '{}');
          context.address = addresses[addresses.length - 1];
          await whatsappSessionService.updateState(phone, 'awaiting_payment', context);
          return paymentList();
        }
      }
      return messageFormatter.askAddress();
    }

    const context = JSON.parse(session.context || '{}');
    context.address = message;

    await whatsappSessionService.updateState(phone, 'awaiting_payment', context);
    return paymentList();
  }

  private async handlePaymentInput(phone: string, message: string, session: any): Promise<HandlerResponse> {
    if (['não', 'nao', 'cancelar'].includes(message)) {
      await whatsappSessionService.resetSession(phone);
      return messageFormatter.cancelConfirmation();
    }

    const PAYMENT_MAP = buildPaymentMap();
    const paymentMethod = PAYMENT_MAP[message] || PAYMENT_MAP[message.toLowerCase()];
    if (!paymentMethod) {
      return paymentList();
    }

    const context = JSON.parse(session.context || '{}');
    context.paymentMethod = paymentMethod;

    // PIX flow: show PIX key and wait for confirmation
    if (paymentMethod === 'pix') {
      const pixKey = settingsAgent.getPixKey();
      if (pixKey) {
        await whatsappSessionService.updateState(phone, 'awaiting_pix_confirmation' as SessionState, context);
        return buttons(
          messageFormatter.askPixProof(pixKey, context.items),
          { id: 'cancelar', text: '❌ Cancelar pedido' },
        );
      }
      // No PIX key configured — fall through to normal flow
    }

    await whatsappSessionService.updateState(phone, 'awaiting_notes', context);
    return buttons(
      messageFormatter.askNotes(),
      { id: 'nao', text: '🚫 Sem observações' },
    );
  }

  private async handlePixConfirmation(phone: string, message: string, session: any): Promise<HandlerResponse> {
    const context = JSON.parse(session.context || '{}');

    if (['cancelar', 'cancela', 'cancel', 'não', 'nao'].includes(message)) {
      await whatsappSessionService.resetSession(phone);
      return messageFormatter.cancelConfirmation();
    }

    // Customer sent proof (any message counts). Notify admin.
    const deliveryFee = settingsAgent.calculateTimeBasedDeliveryFee();
    const total = (context.items || []).reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 0), 0) + deliveryFee;
    const pixKey = settingsAgent.getPixKey();

    emitPixPending({
      phone,
      customerName: context.customerName || 'Cliente',
      total,
      items: (context.items || []).map((i: any) => ({ name: i.name || i.productName || 'Item', quantity: i.quantity || 1, price: i.price || 0 })),
      address: context.address || '',
      notes: context.notes || '',
      deliveryFee,
    });

    return buttons(
      messageFormatter.pixPending(pixKey, total),
      { id: 'cancelar', text: '❌ Cancelar pedido' },
    );
  }

  private async saveHistory(phone: string, session: any, userMsg: string, assistantMsg: string): Promise<void> {
    try {
      const context = JSON.parse(session.context || '{}');
      const history = context.history || [];
      history.push({ role: 'user', content: userMsg });
      history.push({ role: 'assistant', content: assistantMsg });
      // Keep only last 10 messages
      const trimmed = history.slice(-10);
      await whatsappSessionService.updateState(phone, 'idle', { ...context, history: trimmed });
    } catch {
      // Non-critical, don't break the flow
    }
  }

  private async handleOrderPlaced(phone: string, message: string, session: any): Promise<HandlerResponse> {
    const context = JSON.parse(session.context || '{}');

    // Greetings → go to idle but keep lastOrder for status checking
    const greetings = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi', 'hey', 'eai', 'opa', 'fala'];
    if (greetings.some(g => message.startsWith(g))) {
      await whatsappSessionService.updateState(phone, 'idle', {
        lastOrderId: context.lastOrderId,
        lastOrderNumber: context.lastOrderNumber,
      });
      const name = context.customerName || 'cliente';
      return buttons(
        `Olá, ${name}! 👋\n\nComo posso ajudar?`,
        { id: 'cardapio', text: '📋 Cardápio' },
        { id: 'novo pedido', text: '🛒 Novo pedido' },
        { id: 'acompanhar', text: '📦 Acompanhar' },
        { id: 'atendente', text: '👤 Atendente' },
      );
    }

    if (['novo pedido', 'novo', 'pedir', 'quero pedir', 'menu', 'cardapio', 'cardápio', '1', '2'].includes(message)) {
      await whatsappSessionService.resetSession(phone);
      const catalog = await productsService.getCatalog();
      return messageFormatter.catalog(catalog) + '\n\nDigite os itens que deseja! Digite o nome dos produtos';
    }

    if (['acompanhar', 'status', 'meu pedido', '3'].includes(message)) {
      if (context.lastOrderId) {
        const order = await ordersService.getById(context.lastOrderId);
        return messageFormatter.statusUpdate(order.order_number, order.status);
      }
      return 'Você não tem pedidos ativos no momento. 🛒';
    }

    if (['atendente', 'humano', '4'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'agent_active' as SessionState, {
        ...context,
        agentStartedAt: new Date().toISOString(),
      });
      emitAgentRequest(phone, context.customerName || 'Cliente');
      return 'Estamos conectando você com um atendente. Aguarde um momento! 🙏';
    }

    // Default: show order options
    const orderNum = context.lastOrderNumber || '';
    return buttons(
      `✅ Pedido #${orderNum} confirmado!`,
      { id: 'cardapio', text: '📋 Cardápio' },
      { id: 'novo pedido', text: '🛒 Novo pedido' },
      { id: 'acompanhar', text: '📦 Acompanhar' },
      { id: 'atendente', text: '👤 Atendente' },
    );
  }

  private async processPendingVariant(phone: string, pendingVariant: any, allProducts: any[], session: any, message: string, existingItems?: any[]): Promise<HandlerResponse> {
    const fullProduct = await productsService.getFullProduct(pendingVariant.product_id!);

    const pendingItemData: any = {
      product: fullProduct,
      product_id: pendingVariant.product_id,
      name: pendingVariant.name,
      quantity: pendingVariant.quantity,
      price: pendingVariant.price,
    };
    if (pendingVariant.halves) pendingItemData.halves = pendingVariant.halves;
    if (pendingVariant.modifiers) pendingItemData.modifiers = pendingVariant.modifiers;

    const context = JSON.parse(session.context || '{}');
    const otherItems = existingItems || allProducts.filter((p: any) => p.valid !== false).map((p: any) => ({
      product_id: p.product_id, name: p.name, quantity: p.quantity, price: p.price,
      variant_id: p.variant_id, halves: p.halves, modifiers: p.modifiers,
    }));

    const historyEntries = [
      ...(context.history || []).slice(-4),
      { role: 'user', content: message },
    ];

    if (pendingVariant.variant_id) {
      const matchedVariant = fullProduct.variants?.find((v: any) => v.id === pendingVariant.variant_id);
      if (matchedVariant) {
        pendingItemData.variant_id = matchedVariant.id;
        if (pendingItemData.halves) {
          pendingItemData.name = pendingItemData.name.replace(fullProduct.name, `${fullProduct.name} ${matchedVariant.name}`);
        } else {
          pendingItemData.name = `${fullProduct.name} ${matchedVariant.name}`;
        }
        pendingItemData.price = matchedVariant.promo_price || matchedVariant.price;
        if (pendingItemData.modifiers) {
          pendingItemData.price += pendingItemData.modifiers.reduce((s: number, m: any) => s + (m.price_add || 0), 0);
        }

        const requiredMods = (fullProduct.modifiers || []).filter((m: any) => m.type === 'required');
        if (requiredMods.length > 0 && !pendingItemData.halves && (!pendingItemData.modifiers || pendingItemData.modifiers.length === 0)) {
          pendingItemData.modifiers = [];
          await whatsappSessionService.updateState(phone, 'awaiting_modifier' as SessionState, {
            pendingItem: pendingItemData,
            pendingModifierIndex: 0,
            items: otherItems,
            history: historyEntries,
          });
          const firstMod = requiredMods[0];
          const activeOpts = (firstMod.options || []).filter((o: any) => o.is_active);
          return buttons(
            `Escolha *${firstMod.name}*:`,
            ...activeOpts.map((o: any) => ({
              id: o.name.toLowerCase(),
              text: `${o.name}${o.price_add > 0 ? ` (+R$${o.price_add.toFixed(2)})` : ''}`,
            })),
          );
        }

        if (pendingItemData.modifiers && pendingItemData.modifiers.length > 0 && !pendingItemData.halves) {
          const flavorNames = pendingItemData.modifiers.map((m: any) => m.option_name).join(', ');
          pendingItemData.name = `${pendingItemData.name} - ${flavorNames}`;
        }

        const items = [...otherItems, pendingItemData];
        await whatsappSessionService.updateState(phone, 'awaiting_items', { items, history: historyEntries });
        const displayItems = items.map((i: any) => `• ${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2)}`).join('\n');
        const subtotal = items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
        return buttons(
          `📋 *Pedido:*\n${displayItems}\n\n💰 *Total: R$ ${subtotal.toFixed(2)}*`,
          { id: 'sim', text: '✅ Confirmar' },
          { id: 'adicionar', text: '➕ Adicionar mais' },
        );
      }
    }

    await whatsappSessionService.updateState(phone, 'awaiting_variant' as SessionState, {
      pendingItem: pendingItemData,
      items: otherItems,
      history: historyEntries,
    });
    const activeVariants = (fullProduct.variants || []).filter((v: any) => v.is_active);
    return buttons(
      `Para *${fullProduct.name}*, qual tamanho você quer?`,
      ...activeVariants.map((v: any) => ({
        id: v.name.toLowerCase(),
        text: `${v.name} - R$ ${(v.promo_price || v.price).toFixed(2)}`,
      })),
    );
  }

  private async matchProductDirectly(message: string): Promise<{ product_id: string; name: string; quantity: number; price: number } | null> {
    try {
      const catalog = await productsService.getCatalog();
      const allProducts = catalog.flatMap((cat: any) => cat.products);

      // Normalize: lowercase, remove accents, trim
      const normalized = message
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Strip quantity prefix (e.g., "2x cafe coado" → "cafe coado")
      const withoutQty = normalized.replace(/^\d+\s*x?\s*/, '').trim();

      // Try direct substring match against product names
      for (const p of allProducts) {
        const nameNorm = p.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (nameNorm.includes(withoutQty) || withoutQty.includes(nameNorm)) {
          const stock = p.stock ?? 999;
          if (stock <= 0) continue;

          const qtyMatch = normalized.match(/(\d+)\s*x/) || normalized.match(/(\d+)/);
          const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

          return {
            product_id: p.id,
            name: p.name,
            quantity,
            price: p.promo_price || p.price,
          };
        }
      }
    } catch {
      // Non-critical, fall through
    }
    return null;
  }

  private mergeItemsLocal(existing: any[], newItems: any[]): any[] {
    const map = new Map<string, any>();
    for (const item of existing) {
      if (item.product_id) {
        const key = item.variant_id ? `${item.product_id}_${item.variant_id}` : item.product_id;
        map.set(key, { ...item });
      }
    }
    for (const item of newItems) {
      const key = item.variant_id ? `${item.product_id}_${item.variant_id}` : item.product_id;
      const ex = map.get(key);
      if (ex) {
        ex.quantity += item.quantity;
      } else {
        map.set(key, { ...item });
      }
    }
    return Array.from(map.values());
  }

  private checkMinimumOrder(items: any[]): string | null {
    const subtotal = (items || []).reduce((sum: number, i: any) => sum + (i.price || 0) * (i.quantity || 0), 0);
    const minOrder = settingsAgent.getMinOrder();
    if (minOrder > 0 && subtotal > 0 && subtotal < minOrder) {
      return `⚠️ Pedido mínimo: R$ ${minOrder.toFixed(2)}. Seu pedido está R$ ${subtotal.toFixed(2)} (falta R$ ${(minOrder - subtotal).toFixed(2)}).\n\nAdicione mais itens para continuar.`;
    }
    return null;
  }

  private async handleNotesInput(phone: string, message: string, session: any): Promise<string> {
    const context = JSON.parse(session.context || '{}');
    const notes = ['não', 'nao', 'no', 'nada', 'sem'].includes(message.toLowerCase()) ? '' : message;

    // Create the order
    try {
      // Check license before creating order
      const licenseStatus = await licenseService.validateCurrent(false);
      if (!licenseStatus.canCreateOrders) {
        await whatsappSessionService.resetSession(phone);
        return 'Desculpe, o sistema está temporariamente indisponível para novos pedidos. Por favor, tente novamente mais tarde. 😔';
      }

      const customer = await customersService.getOrCreateByPhone(phone);
      const items = (context.items || []).map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        variant_id: item.variant_id || undefined,
        halves: item.halves || undefined,
        modifiers: item.modifiers || undefined,
      }));

      // Validate minimum order and calculate delivery fee
      const itemsWithPrices = (context.items || []).map((item: any) => ({
        quantity: item.quantity,
        unit_price: item.price,
      }));
      try {
        orderValidator.validateOrThrow({
          items: itemsWithPrices,
          order_type: 'delivery',
        });
      } catch (err: any) {
        await whatsappSessionService.resetSession(phone);
        return `❌ ${err.message}`;
      }

      const result = await ordersService.create({
        customer_id: customer.id,
        items,
        payment_method: context.paymentMethod,
        delivery_address: context.address,
        notes: notes || undefined,
      });

      const { order, stockWarnings } = result as any;

      await whatsappSessionService.updateState(phone, 'order_placed', {
        lastOrderId: order.id,
        lastOrderNumber: order.order_number,
      });

      return messageFormatter.orderPlaced(order, stockWarnings);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error creating order');
      await whatsappSessionService.resetSession(phone);
      return 'Ops, deu um erro ao criar o pedido. Pode tentar novamente? 😅';
    }
  }
}

export const whatsappHandler = new WhatsAppHandler();
