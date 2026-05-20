import { whatsappSessionService, SessionState } from './whatsapp.service';
import { messageFormatter } from './whatsapp.formatter';
import { nlpService } from '../../services/nlp/nlp.service';
import { aiService } from '../../services/ai/ai.service';
import { productsService } from '../products/products.service';
import { customersService } from '../customers/customers.service';
import { ordersService } from '../orders/orders.service';
import { logger } from '../../shared/middlewares/logger';
import { normalizePhone } from '../../shared/utils/phone';

const BOT_MODE = process.env.BOT_MODE || 'ai'; // 'ai' or 'nlp'
logger.info({ mode: BOT_MODE }, '[HANDLER] Bot mode configured');

const PAYMENT_MAP: Record<string, string> = {
  '1': 'cash', 'dinheiro': 'cash', 'cash': 'cash',
  '2': 'credit_card', 'crédito': 'credit_card', 'credito': 'credit_card', 'cartão': 'credit_card', 'cartao': 'credit_card',
  '3': 'debit_card', 'débito': 'debit_card', 'debito': 'debit_card',
  '4': 'pix', 'pix': 'pix',
  '5': 'voucher', 'vale': 'voucher', 'voucher': 'voucher',
};

export class WhatsAppHandler {
  async handleMessage(phone: string, message: string, senderName?: string, whatsappJid?: string): Promise<string> {
    const normalizedPhone = normalizePhone(phone);
    const session = await whatsappSessionService.getOrCreate(normalizedPhone);
    const normalized = message.toLowerCase().trim();

    logger.info({ phone: normalizedPhone, state: session.state, message }, '[HANDLER] Processing message');

    // Handle based on session state
    switch (session.state) {
      case 'idle':
        return this.handleIdle(normalizedPhone, normalized, session, senderName);
      case 'awaiting_items':
        return this.handleItemsInput(normalizedPhone, normalized, session);
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
      case 'awaiting_cancel':
        return this.handleAwaitingCancel(normalizedPhone, normalized, session);
      default:
        await whatsappSessionService.resetSession(normalizedPhone);
        return this.handleIdle(normalizedPhone, normalized, session, senderName);
    }
  }

  private async handleIdle(phone: string, message: string, session: any, senderName?: string): Promise<string> {
    const displayName = senderName || 'cliente';

    // Greetings
    const greetings = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi', 'hey', 'eai', 'e ai', 'opa', 'fala'];
    if (greetings.some(g => message.startsWith(g))) {
      return `Olá, ${displayName}! 👋\n\n` +
             'Como posso ajudar?\n\n' +
             '*1* - Ver cardápio\n' +
             '*2* - Fazer pedido\n' +
             '*3* - Acompanhar pedido\n' +
             '*4* - Falar com atendente';
    }

    if (message === '1' || ['cardapio', 'cardápio', 'menu', 'produtos'].includes(message)) {
      const catalog = await productsService.getCatalog();
      return messageFormatter.catalog(catalog);
    }

    if (message === '2' || ['pedido', 'fazer pedido', 'pedir', 'quero pedir'].includes(message)) {
      const catalog = await productsService.getCatalog();
      return messageFormatter.catalog(catalog) + '\n\nDigite os itens que deseja! Ex: *2 Heineken, 1 Batata*';
    }

    if (message === '3' || ['meu pedido', 'status', 'acompanhar'].includes(message)) {
      const context = JSON.parse(session.context || '{}');
      if (context.lastOrderId) {
        const order = await ordersService.getById(context.lastOrderId);
        return messageFormatter.statusUpdate(order.order_number, order.status);
      }
      return 'Você não tem pedidos ativos no momento. 🛒';
    }

    if (message === '4' || ['atendente', 'humano', 'pessoa', 'falar com alguém'].includes(message)) {
      return 'Estamos conectando você com um atendente. Aguarde um momento! 🙏';
    }

    if (['promoções', 'promocoes', 'promos', 'ofertas'].includes(message)) {
      return messageFormatter.promotions([]);
    }

    if (['ajuda', 'help'].includes(message)) {
      return 'Como posso ajudar? Digite:\n\n*1* - Ver cardápio\n*2* - Fazer pedido\n*3* - Acompanhar pedido\n*4* - Falar com atendente';
    }

    // Interpret message using configured mode (AI or NLP)
    try {
      const response = BOT_MODE === 'nlp'
        ? await nlpService.parseMessage(message, session)
        : await aiService.interpretMessage(message, session);

      switch (response.intent) {
        case 'novo_pedido':
          // Response has products — save to session
          if (response.products.length > 0) {
            await whatsappSessionService.updateState(phone, 'awaiting_items', {
              items: response.products.map((p: any) => ({
                product_id: p.product_id,
                name: p.name,
                quantity: p.quantity,
                price: p.price,
              })),
              history: [
                ...(JSON.parse(session.context || '{}').history || []).slice(-4),
                { role: 'user', content: message },
                { role: 'assistant', content: response.message },
              ],
            });
            return response.message;
          }

          // No products but has message (disambiguation, category options, etc.)
          if (response.message) {
            await this.saveHistory(phone, session, message, response.message);
            return response.message;
          }
          return 'Não consegui identificar os itens. Pode repetir? Ex: *2 Heineken, 1 Batata* 🍻';

        case 'cardapio':
          const catalog = await productsService.getCatalog();
          return messageFormatter.catalog(catalog);

        case 'promocao':
          return messageFormatter.promotions([]);

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
      return `Desculpe, não entendi. Digite:\n\n*1* - Ver cardápio\n*2* - Fazer pedido\n*3* - Acompanhar pedido\n*4* - Falar com atendente`;
    }
  }

  private async handleItemsInput(phone: string, message: string, session: any): Promise<string> {
    const context = JSON.parse(session.context || '{}');

    // Check if adding more items
    if (['mais', 'adicionar', 'add', '+'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'idle', context);
      return 'O que mais deseja adicionar? 🛒';
    }

    // Check if confirming
    if (['sim', 's', 'confirmar', 'ok', 'pode', 'fechou'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'awaiting_name', context);
      return messageFormatter.askName();
    }

    // Check if wants to cancel — ask first
    if (['não', 'nao', 'n'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'awaiting_cancel', context);
      return 'Deseja adicionar mais itens ou cancelar o pedido?\n\n*Adicionar* - voltar ao pedido\n*Cancelar* - cancelar tudo';
    }

    // Interpret message using configured mode
    const aiResponse = BOT_MODE === 'nlp'
      ? await nlpService.parseMessage(message, session)
      : await aiService.interpretMessage(message, session);

    // NLP/AI returned products — update session
    if (aiResponse.products.length > 0) {
      await whatsappSessionService.updateState(phone, 'awaiting_items', {
        items: aiResponse.products.map((p: any) => ({
          product_id: p.product_id,
          name: p.name,
          quantity: p.quantity,
          price: p.price,
        })),
        history: context.history,
      });
      return aiResponse.message;
    }

    // NLP/AI returned a message (disambiguation, category options, removal, etc.)
    if (aiResponse.message) {
      // If the response indicates confirmation needed (removal result), update session
      if (aiResponse.needs_confirmation && aiResponse.products.length > 0) {
        await whatsappSessionService.updateState(phone, 'awaiting_items', {
          items: aiResponse.products.map((p: any) => ({
            product_id: p.product_id,
            name: p.name,
            quantity: p.quantity,
            price: p.price,
          })),
          history: context.history,
        });
      }
      return aiResponse.message;
    }

    return 'O que deseja fazer com o pedido?\n\n*Sim* - Confirmar\n*Não* - Cancelar\n*Adicionar* - mais itens\n*Remover [item]* - tirar item';
  }

  private async handleConfirmation(phone: string, message: string, session: any): Promise<string> {
    if (['sim', 's', 'confirmar', 'ok', 'pode', 'fechou'].includes(message)) {
      const context = JSON.parse(session.context || '{}');
      await whatsappSessionService.updateState(phone, 'awaiting_name', context);
      return messageFormatter.askName();
    }

    if (['não', 'nao', 'n'].includes(message)) {
      const context = JSON.parse(session.context || '{}');
      await whatsappSessionService.updateState(phone, 'awaiting_cancel', context);
      return 'Deseja adicionar mais itens ou cancelar o pedido?\n\n*Adicionar* - voltar ao pedido\n*Cancelar* - cancelar tudo';
    }

    return 'Confirma o pedido?\n\n*Sim* - Confirmar\n*Não* - Cancelar';
  }

  private async handleAwaitingCancel(phone: string, message: string, session: any): Promise<string> {
    const context = JSON.parse(session.context || '{}');

    if (['adicionar', 'add', 'mais', 'voltar', 'continuar'].includes(message)) {
      await whatsappSessionService.updateState(phone, 'awaiting_items', context);
      return 'O que mais deseja adicionar? 🛒';
    }

    if (['cancelar', 'cancela', 'cancel', 'sair'].includes(message)) {
      await whatsappSessionService.resetSession(phone);
      return messageFormatter.cancelConfirmation();
    }

    return 'O que deseja fazer?\n\n*Adicionar* - adicionar mais itens\n*Cancelar* - cancelar o pedido';
  }

  private async handleNameInput(phone: string, message: string, session: any, whatsappJid?: string): Promise<string> {
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
      return `📍 *Endereço de Entrega*\n\nÚltimo endereço: ${lastAddress}\n\nDeseja usar este endereço? (sim/não)\nOu digite um novo endereço.`;
    }
    return messageFormatter.askAddress();
  }

  private async handleAddressInput(phone: string, message: string, session: any): Promise<string> {
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
          return messageFormatter.askPayment();
        }
      }
      return messageFormatter.askAddress();
    }

    const context = JSON.parse(session.context || '{}');
    context.address = message;

    await whatsappSessionService.updateState(phone, 'awaiting_payment', context);
    return messageFormatter.askPayment();
  }

  private async handlePaymentInput(phone: string, message: string, session: any): Promise<string> {
    if (['não', 'nao', 'cancelar'].includes(message)) {
      await whatsappSessionService.resetSession(phone);
      return messageFormatter.cancelConfirmation();
    }

    const paymentMethod = PAYMENT_MAP[message] || PAYMENT_MAP[message.toLowerCase()];
    if (!paymentMethod) {
      return messageFormatter.askPayment();
    }

    const context = JSON.parse(session.context || '{}');
    context.paymentMethod = paymentMethod;

    await whatsappSessionService.updateState(phone, 'awaiting_notes', context);
    return messageFormatter.askNotes();
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

  private async handleNotesInput(phone: string, message: string, session: any): Promise<string> {
    const context = JSON.parse(session.context || '{}');
    const notes = ['não', 'nao', 'no', 'nada', 'sem'].includes(message.toLowerCase()) ? '' : message;

    // Create the order
    try {
      const customer = await customersService.getOrCreateByPhone(phone);
      const items = (context.items || []).map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const order = await ordersService.create({
        customer_id: customer.id,
        items,
        payment_method: context.paymentMethod,
        delivery_address: context.address,
        notes: notes || undefined,
      });

      await whatsappSessionService.updateState(phone, 'idle', {
        lastOrderId: order.id,
        lastOrderNumber: order.order_number,
      });

      return messageFormatter.orderPlaced(order);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error creating order');
      await whatsappSessionService.resetSession(phone);
      return 'Ops, deu um erro ao criar o pedido. Pode tentar novamente? 😅';
    }
  }
}

export const whatsappHandler = new WhatsAppHandler();
