import { ordersModel } from './orders.model';
import { customersModel } from '../customers/customers.model';
import { productsModel } from '../products/products.model';
import { stockModel } from '../stock/stock.model';
import { couponsModel } from '../coupons/coupons.model';
import { cashRegisterService } from '../cash-register/cash-register.service';
import { AppError } from '../../shared/errors/app-error';
import { Order, OrderStatus } from '../../shared/types';
import { logger } from '../../shared/middlewares/logger';
import { emitOrderNew, emitOrderStatusChanged, emitOrderUpdated, emitStockLow } from '../../services/websocket/ws.server';
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
    coupon_code?: string;
    whatsapp_message_id?: string;
  }) {
    // Validate products and calculate totals
    const items: Array<{ product_id: string; product_name: string; quantity: number; unit_price: number; notes?: string }> = [];
    const stockWarnings: Array<{ product_name: string; requested: number; available: number }> = [];
    let subtotal = 0;

    for (const item of data.items) {
      const product = await productsModel.findById(item.product_id);
      if (!product) throw AppError.badRequest(`Produto não encontrado: ${item.product_id}`);
      if (product.is_active !== 1) throw AppError.badRequest(`Produto inativo: ${product.name}`);
      if (product.stock < item.quantity) {
        stockWarnings.push({ product_name: product.name, requested: item.quantity, available: product.stock });
      }

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

    const metadata = stockWarnings.length > 0 ? JSON.stringify({ stockWarnings }) : undefined;

    // Apply coupon if provided
    let discount = 0;
    let couponId: string | undefined;
    if (data.coupon_code) {
      const coupon = couponsModel.findByCode(data.coupon_code);
      if (!coupon) throw AppError.badRequest('Cupom inválido ou inativo');
      const now = new Date().toISOString();
      if (now < coupon.start_date || now > coupon.end_date) throw AppError.badRequest('Cupom expirado ou ainda não válido');
      if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) throw AppError.badRequest('Cupom atingiu o limite de uso');
      if (coupon.min_order_value && subtotal < coupon.min_order_value) {
        throw AppError.badRequest(`Valor mínimo do pedido: R$ ${coupon.min_order_value.toFixed(2)}`);
      }
      if (coupon.type === 'percentage') {
        discount = subtotal * (coupon.value / 100);
        if (coupon.max_discount && discount > coupon.max_discount) discount = coupon.max_discount;
      } else if (coupon.type === 'fixed') {
        discount = coupon.value;
      }
      discount = Math.round(discount * 100) / 100;
      couponId = coupon.id;
    }

    const total = Math.max(0, subtotal - discount);

    const order = await ordersModel.create({
      ...data,
      items,
      subtotal,
      discount,
      total,
      coupon_id: couponId,
      metadata,
    });

    // Increment coupon usage
    if (couponId) {
      couponsModel.incrementUsage(couponId);
    }

    // Update customer stats
    await customersModel.updateOrderStats(data.customer_id, order.total);

    // Update stock
    for (const item of items) {
      const product = await productsModel.findById(item.product_id);
      const previousStock = product?.stock || 0;
      await productsModel.updateStock(item.product_id, -item.quantity);
      stockModel.createMovement({
        product_id: item.product_id,
        type: 'sale',
        quantity: -item.quantity,
        previous_stock: previousStock,
        new_stock: previousStock - item.quantity,
        reference_type: 'order',
        reference_id: order.id,
        created_by: 'system',
      });
      await this.checkAndEmitLowStock(item.product_id);
    }

    logger.info({ orderId: order.id, orderNumber: order.order_number, stockWarnings: stockWarnings.length }, 'Order created');

    // Register cash movement if cash register is open
    if (data.payment_method) {
      try { await cashRegisterService.addSaleMovement(order.id, order.total, data.payment_method); } catch { /* Cash register not critical */ }
    }

    // Emit WebSocket event
    try { emitOrderNew(order); } catch { /* WS not critical */ }

    // Print order
    try { printerService.printOrder(order); } catch { /* Printer not critical */ }

    return { order, stockWarnings };
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
    const order = await this.getById(id);

    // Prevent double stock restoration
    if (order.status === 'cancelled') {
      throw AppError.badRequest('Pedido já está cancelado');
    }

    // Restore stock for each item before cancelling
    for (const item of order.items) {
      const product = await productsModel.findById(item.product_id);
      const previousStock = product?.stock || 0;
      await productsModel.updateStock(item.product_id, item.quantity);
      stockModel.createMovement({
        product_id: item.product_id,
        type: 'cancellation',
        quantity: item.quantity,
        previous_stock: previousStock,
        new_stock: previousStock + item.quantity,
        reference_type: 'order',
        reference_id: order.id,
        created_by: changedBy,
      });
      await this.checkAndEmitLowStock(item.product_id);
    }

    // Register cash reversal if cash register is open
    if (order.payment_method) {
      try { await cashRegisterService.addReversalMovement(order.id, order.total, order.payment_method); } catch { /* Cash register not critical */ }
    }

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

  private async checkAndEmitLowStock(productId: string) {
    const product = await productsModel.findById(productId);
    if (product && product.stock <= product.min_stock) {
      try {
        emitStockLow({ id: product.id, name: product.name, stock: product.stock, min_stock: product.min_stock });
      } catch { /* WS not critical */ }
    }
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
