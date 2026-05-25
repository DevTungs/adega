import { Order, OrderStatus } from '../../shared/types';

export class MessageFormatter {
  catalog(catalog: any[]): string {
    let msg = '📋 *Nosso Cardápio*\n\n';
    for (const category of catalog) {
      msg += `*${category.name}*\n`;
      for (const product of category.products) {
        const price = product.promo_price || product.price;
        msg += `• ${product.name} - R$ ${price.toFixed(2)}`;
        if (product.promo_price) msg += ' 🏷️ *PROMO*';
        msg += '\n';
      }
      msg += '\n';
    }
    msg += 'Digite o que deseja pedir! 🛒';
    return msg;
  }

  promotions(promotions: any[]): string {
    if (!promotions.length) return '🏷️ Nenhuma promoção ativa no momento.';
    let msg = '🏷️ *Promoções Ativas*\n\n';
    for (const promo of promotions) {
      msg += `• *${promo.name}*\n`;
      if (promo.description) msg += `  ${promo.description}\n`;
      msg += `  Válido até ${new Date(promo.end_date).toLocaleDateString('pt-BR')}\n\n`;
    }
    msg += 'Aproveite!';
    return msg;
  }

  orderConfirmation(items: Array<{ name: string; quantity: number; price: number; total: number }>, subtotal: number): string {
    let msg = '📋 *Resumo do Pedido*\n\n';
    for (const item of items) {
      msg += `${item.quantity}x ${item.name} - R$ ${item.total.toFixed(2)}\n`;
    }
    msg += `\n*Subtotal: R$ ${subtotal.toFixed(2)}*`;
    msg += '\n\n✅ Confirmar? (sim/não)';
    return msg;
  }

  orderPlaced(order: any, stockWarnings?: Array<{ product_name: string; requested: number; available: number }>): string {
    let msg = `✅ *Pedido #${order.order_number} confirmado!*\n\n` +
              `⏱️ Previsão: 30-45 minutos\n` +
              (order.delivery_address ? `📍 ${order.delivery_address}\n\n` : '\n');

    if (stockWarnings && stockWarnings.length > 0) {
      msg += `⚠️ *Aviso de estoque:*\n`;
      for (const w of stockWarnings) {
        msg += `• ${w.product_name} — pediu ${w.requested}, tem ${w.available} em estoque\n`;
      }
      msg += `\nEntraremos em contato caso não consigamos atender o pedido completo. 📞\n\n`;
    }

    msg += `Acompanhe pelo menu "Meu Pedido" 📦`;
    return msg;
  }

  statusUpdate(orderNumber: number, status: OrderStatus): string {
    const messages: Record<string, string> = {
      confirmed: `✅ Pedido #${orderNumber} foi confirmado!`,
      preparing: `🍳 Pedido #${orderNumber} está sendo preparado!`,
      ready: `📦 Pedido #${orderNumber} está pronto!`,
      out_for_delivery: `🛵 Pedido #${orderNumber} saiu para entrega!`,
      delivered: `✅ Pedido #${orderNumber} foi entregue! Obrigado! 🙏`,
      cancelled: `❌ Pedido #${orderNumber} foi cancelado.`,
    };
    return messages[status] || '';
  }

  askName(): string {
    return 'Qual é o seu nome? 😊';
  }

  askAddress(): string {
    return 'Qual o endereço para entrega? 📍\n(Rua, número, bairro)';
  }

  askPayment(): string {
    return 'Qual a forma de pagamento? 💳\n\n' +
           '1️⃣ Dinheiro\n' +
           '2️⃣ Cartão de Crédito\n' +
           '3️⃣ Cartão de Débito\n' +
           '4️⃣ PIX\n' +
           '5️⃣ Vale';
  }

  askNotes(): string {
    return 'Alguma observação? (troco, referência, etc)\n\nDigite "não" se não tiver.';
  }

  help(): string {
    return '❓ *Menu de Ajuda*\n\n' +
           '• Digite o nome do produto para pedir\n' +
           '• *cardápio* - ver produtos\n' +
           '• *promoções* - ver ofertas\n' +
           '• *meu pedido* - status do pedido\n' +
           '• *ajuda* - este menu\n\n' +
           'Exemplo: "2 [produto], 1 [produto]"';
  }

  productNotFound(query: string): string {
    return `Desculpa, não encontrei "${query}" 😅\nDigite *cardápio* para ver nossos produtos.`;
  }

  emptyCart(): string {
    return 'Seu carrinho está vazio! 🛒\nDigite o nome do produto que deseja pedir.';
  }

  cancelConfirmation(): string {
    return 'Pedido cancelado. 😔\nQuando quiser, é só chamar!';
  }
}

export const messageFormatter = new MessageFormatter();
