import { Order, OrderStatus } from '../../shared/types';
import { settingsAgent } from '../../services/settings/settings.service';

export class MessageFormatter {
  catalog(catalog: any[]): string {
    let msg = '📋 *Nosso Cardápio*\n\n';
    for (const category of catalog) {
      msg += `*${category.name}*\n`;
      for (const product of category.products) {
        const hasVariants = product.variants && product.variants.length > 0;
        const activeVariants = hasVariants ? product.variants.filter((v: any) => v.is_active !== 0) : [];

        if (activeVariants.length > 0) {
          // Show product name with variant names and prices
          const variantList = activeVariants
            .map((v: any) => `${v.name} R$ ${(v.promo_price || v.price).toFixed(2)}`)
            .join(', ');
          msg += `• ${product.name} - ${variantList}`;
        } else {
          const price = product.promo_price || product.price;
          msg += `• ${product.name} - R$ ${price.toFixed(2)}`;
        }
        if (product.promo_price) msg += ' 🏷️ *PROMO*';
        msg += '\n';
      }
      msg += '\n';
    }
    msg += 'Digite o que deseja pedir! 🛒';
    return msg;
  }


  orderConfirmation(items: Array<{ name: string; quantity: number; price: number; total: number }>, subtotal: number): string {
    const deliveryFee = settingsAgent.calculateTimeBasedDeliveryFee();
    const minOrder = settingsAgent.getMinOrder();
    const total = subtotal + deliveryFee;

    let msg = '📋 *Resumo do Pedido*\n\n';
    for (const item of items) {
      msg += `${item.quantity}x ${item.name} - R$ ${item.total.toFixed(2)}\n`;
    }
    msg += `\n*Subtotal: R$ ${subtotal.toFixed(2)}*`;
    if (deliveryFee > 0) {
      msg += `\n🛵 *Taxa de entrega: R$ ${deliveryFee.toFixed(2)}*`;
    }
    msg += `\n💰 *Total: R$ ${total.toFixed(2)}*`;
    if (minOrder > 0 && subtotal < minOrder) {
      msg += `\n\n⚠️ Pedido mínimo: R$ ${minOrder.toFixed(2)} (falta R$ ${(minOrder - subtotal).toFixed(2)})`;
    }
    msg += '\n\n✅ Confirmar? (sim/não)';
    return msg;
  }

  orderPlaced(order: any, stockWarnings?: Array<{ product_name: string; requested: number; available: number }>): string {
    let msg = `✅ *Pedido #${order.order_number} confirmado!*\n\n` +
              `⏱️ Previsão: 30-45 minutos\n`;

    if (order.delivery_address) {
      msg += `📍 ${order.delivery_address}\n`;
    }

    msg += `\n💰 *Subtotal:* R$ ${Number(order.subtotal).toFixed(2)}`;
    if (order.delivery_fee > 0) {
      msg += `\n🛵 *Taxa de entrega:* R$ ${Number(order.delivery_fee).toFixed(2)}`;
    }
    msg += `\n💵 *Total:* R$ ${Number(order.total).toFixed(2)}`;

    if (stockWarnings && stockWarnings.length > 0) {
      msg += `\n\n⚠️ *Aviso de estoque:*\n`;
      for (const w of stockWarnings) {
        msg += `• ${w.product_name} — pediu ${w.requested}, tem ${w.available} em estoque\n`;
      }
      msg += `\nEntraremos em contato caso não consigamos atender o pedido completo. 📞\n\n`;
    }

    msg += `\nAcompanhe pelo menu "Meu Pedido" 📦`;
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
    const methods = settingsAgent.getPaymentMethods();
    if (methods.length === 0) {
      return 'Qual a forma de pagamento? 💳\n\n' +
             '1️⃣ Dinheiro\n' +
             '2️⃣ Cartão de Crédito\n' +
             '3️⃣ Cartão de Débito\n' +
             '4️⃣ PIX\n' +
             '5️⃣ Vale';
    }
    const lines = methods.map(m => `${m.icon}️⃣ ${m.label}`);
    return 'Qual a forma de pagamento? 💳\n\n' + lines.join('\n');
  }

  askPixProof(pixKey: string, items: any[]): string {
    const subtotal = (items || []).reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 0), 0);
    const deliveryFee = settingsAgent.calculateTimeBasedDeliveryFee();
    const total = subtotal + deliveryFee;

    return `💳 *PIX*\n\n` +
           `Chave PIX:\n` +
           `\`\`\`${pixKey}\`\`\`\n\n` +
           `💰 *Total: R$ ${total.toFixed(2)}*\n\n` +
           `📸 Após fazer o pagamento, envie o *comprovante* aqui (foto ou print).\n\n` +
           `Digite *cancelar* para cancelar o pedido.`;
  }

  pixPending(pixKey: string, total: number): string {
    return `⏳ *Aguardando confirmação do pagamento...*\n\n` +
           `Chave PIX: ${pixKey}\n` +
           `💰 *Valor: R$ ${total.toFixed(2)}*\n\n` +
           `Seu pedido será confirmado assim que o pagamento for verificado. ✅\n` +
           `Acompanhe pelo menu "Meu Pedido" 📦\n\n` +
           `Digite *cancelar* se deseja cancelar.`;
  }

  pixConfirmed(orderNumber: number): string {
    return `✅ *PIX confirmado! Pedido #${orderNumber} registrado!*\n\nAcompanhe pelo menu "Meu Pedido" 📦`;
  }

  pixRejected(): string {
    return `❌ *Pagamento PIX não confirmado.*\n\nSeu pedido foi cancelado. Se precisar, faça um novo pedido. 😔`;
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
