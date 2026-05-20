import { ordersModel } from './orders.model';
import { customersModel } from '../customers/customers.model';
import { productsModel } from '../products/products.model';
import { AppError } from '../../shared/errors/app-error';
import { Order, OrderStatus } from '../../shared/types';
import { logger } from '../../shared/middlewares/logger';
import { emitOrderNew, emitOrderStatusChanged, emitOrderUpdated } from '../../services/websocket/ws.server';
import { printerService } from '../../services/printer/printer.service';
import { baileysService } from '../../services/whatsapp/baileys.service';

export class OrdersService {
  async getAll(filters?: { status?: OrderStatus; customer_id?: string; date_from?: string; date_to?: string; limit?: number; offset?: number }) {
    const [orders, total] = await Promise.all([
      ordersModel.findAll(filters),
      ordersModel.count(filters),
    ]);
    return { orders, total };
  }

  async getById(id: string) {
    const order = await ordersModel.findById(id);
    if (!order) throw AppError.notFound('Pedido não encontrado');
    return order;
  }

  async create(data: {
    customer_id: string;
    items: Array<{ product_id: string; quantity: number; notes?: string }>;
    payment_method?: string;
    delivery_address?: string;
    delivery_notes?: string;
    notes?: string;
    whatsapp_message_id?: string;
  }) {
    // Validate products and calculate totals
    const items: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; notes?: string }> = [];
    let subtotal = 0;

    for (const item of data.items) {
      const product = await productsModel.findById(item.product_id);
      if (!product) throw AppError.badRequest(`Produto não encontrado: ${item.product_id}`);
      if (product.is_active !== 1) throw AppError.badRequest(`Produto inativo: ${product.name}`);
      if (product.stock < item.quantity) throw AppError.badRequest(`Estoque insuficiente para ${product.name}`);

      const price = product.promo_price || product.price;
      items.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: price,
        notes: item.notes,
      });
      subtotal += price * item.quantity;
    }

    const order = await ordersModel.create({
      ...data,
      items,
      subtotal,
      total: subtotal,
    });

    // Update customer stats
    await customersModel.updateOrderStats(data.customer_id, order.total);

    // Update stock
    for (const item of items) {
      await productsModel.updateStock(item.product_id, -item.quantity);
    }

    logger.info({ orderId: order.id, orderNumber: order.order_number }, 'Order created');

    // Emit WebSocket event
    try { emitOrderNew(order); } catch { /* WS not critical */ }

    // Print order
    try { printerService.printOrder(order); } catch { /* Printer not critical */ }

    return order;
  }

  async updateStatus(id: string, status: OrderStatus, changedBy: string = 'admin', notes?: string) {
    const order = await this.getById(id);
    this.validateStatusTransition(order.status as OrderStatus, status);
    await ordersModel.updateStatus(id, status, changedBy, notes);
    logger.info({ orderId: id, oldStatus: order.status, newStatus: status }, 'Order status updated');

    // Emit WebSocket event
    try { emitOrderStatusChanged(id, status); } catch { /* WS not critical */ }

    // Send WhatsApp notification to customer
    try {
      const phoneToSend = order.whatsapp_jid || order.customer_phone;
      logger.info({ customerPhone: phoneToSend, whatsappJid: order.whatsapp_jid, orderId: id, orderNumber: order.order_number }, '[WA] Attempting notification');
      if (phoneToSend) {
        const statusMessages: Record<string, string> = {
          confirmed: `✅ Pedido #${order.order_number} confirmado! Estamos preparando.`,
          preparing: `🍳 Pedido #${order.order_number} em preparação!`,
          ready: `📦 Pedido #${order.order_number} pronto! Será enviado em breve.`,
          out_for_delivery: `🚚 Pedido #${order.order_number} saiu para entrega!`,
          delivered: `🎉 Pedido #${order.order_number} entregue! Obrigado pela preferência!`,
          cancelled: `❌ Pedido #${order.order_number} foi cancelado.${notes ? ` Motivo: ${notes}` : ''}`,
        };
        const message = statusMessages[status];
        if (message) {
          const sent = await baileysService.sendMessage(phoneToSend, message);
          logger.info({ sent, phone: phoneToSend }, '[WA] Notification result');
        }
      } else {
        logger.warn({ orderId: id }, '[WA] No customer phone, skipping notification');
      }
    } catch (err: any) {
      logger.error({ error: err.message, orderId: id }, '[WA] Failed to send notification');
    }

    return this.getById(id);
  }

  async assignDriver(id: string, driverId: string) {
    await this.getById(id);
    await ordersModel.assignDriver(id, driverId);
    return this.getById(id);
  }

  async cancel(id: string, reason: string, changedBy: string = 'admin') {
    return this.updateStatus(id, 'cancelled', changedBy, reason);
  }

  async getTimeline(orderId: string) {
    await this.getById(orderId);
    return ordersModel.getTimeline(orderId);
  }

  async getStats(dateFrom?: string, dateTo?: string) {
    return ordersModel.getStats(dateFrom, dateTo);
  }

  async getActiveByCustomer(customerId: string) {
    return ordersModel.getActiveOrdersByCustomer(customerId);
  }

  private validateStatusTransition(current: OrderStatus, next: OrderStatus) {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['out_for_delivery', 'delivered', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: [],
    };

    if (!validTransitions[current]?.includes(next)) {
      throw AppError.badRequest(`Transição inválida: ${current} → ${next}`);
    }
  }
}

export const ordersService = new OrdersService();
