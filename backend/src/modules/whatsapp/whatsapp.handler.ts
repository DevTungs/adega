import { whatsappSessionService, SessionState } from './whatsapp.service';
import { messageFormatter } from './whatsapp.formatter';
import { aiService } from '../../services/ai/ai.service';
import { productsService } from '../products/products.service';
import { customersService } from '../customers/customers.service';
import { ordersService } from '../orders/orders.service';
import { logger } from '../../shared/middlewares/logger';
import { normalizePhone } from '../../shared/utils/phone';

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

    logger.debug({ phone: normalizedPhone, whatsappJid, state: session.state, message }, 'Processing message');

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
      return messageFormatter.catalog(catalog) + '\n\nDigite os itens que deseja! Ex: *2 Heineken, 1 Salame*';
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

    // For everything else, use AI to interpret
    try {
      const aiResponse = await aiService.interpretMessage(message, session);

      switch (aiResponse.intent) {
        case 'novo_pedido':
          if (aiResponse.products.length > 0) {
            const validProducts = aiResponse.products.filter((p: any) => p.valid);
            const invalidProducts = aiResponse.products.filter((p: any) => !p.valid);

            // If there are invalid products (like generic "Cerveja"), use AI message to ask for clarification
            if (invalidProducts.length > 0 && aiResponse.message) {
              // Still save valid items to context if any
              if (validProducts.length > 0) {
                await whatsappSessionService.updateState(phone, 'awaiting_items', {
                  items: validProducts.map((p: any) => ({
                    product_id: p.product_id,
                    name: p.name,
                    quantity: p.quantity,
                    price: p.price,
                  })),
                  history: [
                    ...(JSON.parse(session.context || '{}').history || []).slice(-4),
                    { role: 'user', content: message },
                    { role: 'assistant', content: aiResponse.message },
                  ],
                });
              }
              return aiResponse.message;
            }

            if (validProducts.length > 0) {
              const items = validProducts.map((p: any) => ({
                name: p.name,
                quantity: p.quantity,
                price: p.price,
                total: p.price * p.quantity,
              }));
              const subtotal = items.reduce((sum: number, i: any) => sum + i.total, 0);

              await whatsappSessionService.updateState(phone, 'awaiting_items', {
                items: validProducts.map((p: any) => ({
                  product_id: p.product_id,
                  name: p.name,
                  quantity: p.quantity,
                  price: p.price,
                })),
                history: [
                  ...(JSON.parse(session.context || '{}').history || []).slice(-4),
                  { role: 'user', content: message },
                  { role: 'assistant', content: 'Pedido reconhecido' },
                ],
              });

              return messageFormatter.orderConfirmation(items, subtotal);
            }
          }
          return 'Não consegui identificar os itens. Pode repetir? Ex: *2 Heineken, 1 Salame* 🍻';

        case 'cardapio':
          const catalog = await productsService.getCatalog();
          return messageFormatter.catalog(catalog);

        case 'promocao':
          return messageFormatter.promotions([]);

        case 'ajuda':
          return messageFormatter.help();

        case 'outro':
          return aiResponse.message;

        default:
          return aiResponse.message || `Desculpe, não entendi. Digite *ajuda* para ver as opções.`;
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'AI interpretation error');
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

    // Try to add more items
    const aiResponse = await aiService.interpretMessage(message, session);
    if (aiResponse.intent === 'novo_pedido' && aiResponse.products.length > 0) {
      const validProducts = aiResponse.products.filter((p: any) => p.valid && p.product_id);
      if (validProducts.length > 0) {
        const existingItems = context.items || [];
        const existingMap = new Map<string, any>();
        for (const item of existingItems) {
          if (item.product_id) {
            existingMap.set(item.product_id, { ...item });
          }
        }

        // Process AI response: update quantities for existing items, add new ones
        for (const p of validProducts) {
          const pid = p.product_id as string;
          const existing = existingMap.get(pid);
          if (existing) {
            existing.quantity = p.quantity;
          } else {
            existingMap.set(pid, {
              product_id: pid,
              name: p.name,
              quantity: p.quantity,
              price: p.price,
            });
          }
        }

        const allItems = Array.from(existingMap.values());

        const displayItems = allItems.map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          total: i.price * i.quantity,
        }));
        const subtotal = displayItems.reduce((sum: number, i: any) => sum + i.total, 0);

        await whatsappSessionService.updateState(phone, 'awaiting_items', {
          items: allItems,
          history: context.history,
        });

        return messageFormatter.orderConfirmation(displayItems, subtotal);
      }
    }

    return 'O que deseja fazer com o pedido?\n\n*Sim* - Confirmar\n*Não* - Cancelar';
  }

  private async handleConfirmation(phone: string, message: string, session: any): Promise<string> {
    if (['sim', 's', 'confirmar', 'ok', 'pode', 'fechou'].includes(message)) {
      const context = JSON.parse(session.context || '{}');
      await whatsappSessionService.updateState(phone, 'awaiting_name', context);
      return messageFormatter.askName();
    }

    if (['não', 'nao', 'n', 'cancelar'].includes(message)) {
      await whatsappSessionService.resetSession(phone);
      return messageFormatter.cancelConfirmation();
    }

    return 'Confirma o pedido?\n\n*Sim* - Confirmar\n*Não* - Cancelar';
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
