import { getDb, qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { Order, OrderItem, OrderStatus } from '../../shared/types';
import { modifiersModel } from '../modifiers/modifiers.model';

export class OrdersModel {
  findAll(filters?: { status?: OrderStatus; customer_id?: string; date_from?: string; date_to?: string; order_type?: string; limit?: number; offset?: number }): any[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.status) {
      conditions.push('o.status = ?');
      params.push(filters.status);
    }
    if (filters?.customer_id) {
      conditions.push('o.customer_id = ?');
      params.push(filters.customer_id);
    }
    if (filters?.order_type) {
      conditions.push('o.order_type = ?');
      params.push(filters.order_type);
    }
    if (filters?.date_from) {
      conditions.push('o.created_at >= ?');
      params.push(filters.date_from);
    }
    if (filters?.date_to) {
      conditions.push('o.created_at <= ?');
      params.push(filters.date_to);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const rows = db.all(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp_jid
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    if (rows.length === 0) return [];

    // Batch load items (single query instead of N)
    const orderIds = rows.map(r => r.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const allItems = db.all(
      `SELECT id, order_id, product_id, product_name, quantity, unit_price, total_price, notes, variant_id, created_at
       FROM order_items WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`,
      orderIds
    );

    const enrichedItems = this.attachItemExtras(allItems);

    const itemsByOrder = new Map<string, any[]>();
    for (const item of enrichedItems) {
      const list = itemsByOrder.get(item.order_id);
      if (list) {
        list.push(item);
      } else {
        itemsByOrder.set(item.order_id, [item]);
      }
    }

    return rows.map(row => ({
      ...row,
      items: itemsByOrder.get(row.id) || [],
    }));
  }

  count(filters?: { status?: OrderStatus }): number {
    const where = filters?.status ? 'status = ?' : undefined;
    const params = filters?.status ? [filters.status] : [];
    return qb.count('orders', where, params);
  }

  private attachItemExtras(items: any[]): any[] {
    if (items.length === 0) return items;
    const db = getDb();
    const itemIds = items.map(i => i.id);
    const placeholders = itemIds.map(() => '?').join(',');

    const halves = db.all(
      `SELECT * FROM order_item_splits WHERE order_item_id IN (${placeholders}) ORDER BY sort_order ASC`,
      itemIds
    );
    const modifiers = db.all(
      `SELECT * FROM order_item_modifiers WHERE order_item_id IN (${placeholders}) ORDER BY created_at ASC`,
      itemIds
    );
    const variants = db.all(
      `SELECT * FROM product_variants WHERE id IN (${placeholders})`,
      items.filter(i => i.variant_id).map(i => i.variant_id)
    );

    const halvesByItem = new Map<string, any[]>();
    for (const h of halves) {
      const list = halvesByItem.get(h.order_item_id) || [];
      list.push(h);
      halvesByItem.set(h.order_item_id, list);
    }

    const modsByItem = new Map<string, any[]>();
    for (const m of modifiers) {
      const list = modsByItem.get(m.order_item_id) || [];
      list.push(m);
      modsByItem.set(m.order_item_id, list);
    }

    const variantMap = new Map<string, any>();
    for (const v of variants) variantMap.set(v.id, v);

    return items.map(item => ({
      ...item,
      variant_id: item.variant_id || null,
      variant: item.variant_id ? (variantMap.get(item.variant_id) || null) : null,
      halves: halvesByItem.get(item.id) || [],
      modifiers: modsByItem.get(item.id) || [],
    }));
  }

  findById(id: string): any {
    const db = getDb();
    const order = db.get(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp_jid
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.id = ?`,
      [id]
    );
    if (order) {
      order.items = this.attachItemExtras(db.all(
        `SELECT id, order_id, product_id, product_name, quantity, unit_price, total_price, notes, variant_id, created_at
         FROM order_items WHERE order_id = ? ORDER BY created_at ASC`,
        [id]
      ));
    }
    return order;
  }

  findByNumber(orderNumber: number): any {
    const db = getDb();
    const order = db.get(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.whatsapp_jid
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
       WHERE o.order_number = ?`,
      [orderNumber]
    );
    if (order) {
      order.items = this.attachItemExtras(db.all(
        `SELECT id, order_id, product_id, product_name, quantity, unit_price, total_price, notes, variant_id, created_at
         FROM order_items WHERE order_id = ? ORDER BY created_at ASC`,
        [order.id]
      ));
    }
    return order;
  }

  getNextOrderNumber(): number {
    const db = getDb();
    return db.nextOrderNumber();
  }

  create(data: {
    customer_id: string;
    items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      notes?: string;
      variant_id?: string;
      halves?: Array<{ product_id: string; product_name?: string; name?: string }>;
      modifiers?: Array<{ modifier_id: string; option_id: string; option_name: string; price_add: number }>;
    }>;
    payment_method?: string;
    payment_splits?: string;
    delivery_address?: string;
    delivery_notes?: string;
    notes?: string;
    subtotal: number;
    discount?: number;
    delivery_fee?: number;
    total: number;
    order_type?: string;
    whatsapp_message_id?: string;
    metadata?: string;
  }): Order {
    const db = getDb();
    const id = uuid();
    const orderNumber = db.nextOrderNumber();
    const now = new Date().toISOString();

    qb.insert('orders', {
      id,
      order_number: orderNumber,
      customer_id: data.customer_id,
      status: 'pending',
      order_type: data.order_type || 'delivery',
      payment_method: data.payment_method || null,
      payment_splits: data.payment_splits || '[]',
      subtotal: data.subtotal,
      discount: data.discount || 0,
      delivery_fee: data.delivery_fee || 0,
      total: data.total,
      delivery_address: data.delivery_address || null,
      delivery_notes: data.delivery_notes || null,
      estimated_time: null,
      assigned_driver: null,
      whatsapp_message_id: data.whatsapp_message_id || null,
      notes: data.notes || null,
      cancel_reason: null,
      metadata: data.metadata || '{}',
      confirmed_at: null,
      preparing_at: null,
      ready_at: null,
      delivered_at: null,
      cancelled_at: null,
      created_at: now,
      updated_at: now,
    });

    // Insert items
    for (const item of data.items) {
      const orderItemId = uuid();
      qb.insert('order_items', {
        id: orderItemId,
        order_id: id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: (item.unit_price * item.quantity) + (item.modifiers || []).reduce((s, m) => s + m.price_add * item.quantity, 0),
        variant_id: item.variant_id || null,
        notes: item.notes || null,
        created_at: now,
      });

      // Insert halves (meia-meia)
      if (item.halves && item.halves.length > 0) {
        for (const half of item.halves) {
          qb.insert('order_item_splits', {
            id: uuid(),
            order_item_id: orderItemId,
            product_id: half.product_id,
            modifier_option_id: null,
            name: half.product_name || half.name,
            ratio: 1 / item.halves.length,
            sort_order: item.halves.indexOf(half) + 1,
            created_at: now,
          });
        }
      }

      // Insert modifiers
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          qb.insert('order_item_modifiers', {
            id: uuid(),
            order_item_id: orderItemId,
            modifier_id: mod.modifier_id,
            option_id: mod.option_id,
            option_name: mod.option_name,
            price_add: mod.price_add,
            created_at: now,
          });
        }
      }

      // Create splits from modifiers with creates_splits
      if (item.modifiers && item.modifiers.length > 0) {
        const splitMods = item.modifiers.filter(m => {
          const modifier = modifiersModel.findById(m.modifier_id);
          return modifier && modifier.creates_splits;
        });
        if (splitMods.length > 0) {
          for (const sm of splitMods) {
            qb.insert('order_item_splits', {
              id: uuid(),
              order_item_id: orderItemId,
              product_id: item.product_id,
              modifier_option_id: sm.option_id,
              name: sm.option_name,
              ratio: 1 / splitMods.length,
              sort_order: splitMods.indexOf(sm) + 1,
              created_at: now,
            });
          }
        }
      }
    }

    // Status history
    qb.insert('order_status_history', {
      id: uuid(),
      order_id: id,
      old_status: null,
      new_status: 'pending',
      changed_by: 'system',
      notes: 'Pedido criado',
      created_at: now,
    });

    return this.findById(id);
  }

  updateStatus(id: string, status: OrderStatus, changedBy: string = 'admin', notes?: string): void {
    const db = getDb();
    const order = this.findById(id);
    if (!order) return;

    const now = new Date().toISOString();
    const timestampField: Record<string, string> = {
      confirmed: 'confirmed_at',
      preparing: 'preparing_at',
      ready: 'ready_at',
      delivered: 'delivered_at',
      cancelled: 'cancelled_at',
    };

    const updates: any = { status, updated_at: now };
    if (timestampField[status]) updates[timestampField[status]] = now;
    if (status === 'cancelled' && notes) updates.cancel_reason = notes;

    qb.update('orders', updates, 'id = ?', [id]);

    qb.insert('order_status_history', {
      id: uuid(),
      order_id: id,
      old_status: order.status,
      new_status: status,
      changed_by: changedBy,
      notes: notes || null,
      created_at: now,
    });
  }

  assignDriver(id: string, driverId: string): void {
    qb.update('orders', { assigned_driver: driverId, updated_at: new Date().toISOString() }, 'id = ?', [id]);
  }

  getTimeline(orderId: string): any[] {
    return qb.select('order_status_history', '*', 'order_id = ?', [orderId]) as any[];
  }

  getActiveOrdersByCustomer(customerId: string): any[] {
    const db = getDb();
    const rows = db.all(
      `SELECT * FROM orders WHERE customer_id = ? AND status NOT IN ('delivered', 'cancelled') ORDER BY created_at DESC`,
      [customerId]
    );
    if (rows.length === 0) return [];

    const orderIds = rows.map((r: any) => r.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const allItems = db.all(
      `SELECT id, order_id, product_id, product_name, quantity, unit_price, total_price, notes, variant_id, created_at
       FROM order_items WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`,
      orderIds
    );

    const enrichedItems = this.attachItemExtras(allItems);
    const itemsByOrder = new Map<string, any[]>();
    for (const item of enrichedItems) {
      const list = itemsByOrder.get(item.order_id);
      if (list) { list.push(item); }
      else { itemsByOrder.set(item.order_id, [item]); }
    }

    return rows.map((row: any) => ({
      ...row,
      items: itemsByOrder.get(row.id) || [],
    }));
  }

  getStats(dateFrom?: string, dateTo?: string): any {
    const db = getDb();
    const conditions: string[] = ["status != 'cancelled'"];
    const params: any[] = [];

    if (dateFrom) { conditions.push('created_at >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('created_at <= ?'); params.push(dateTo); }

    const where = conditions.join(' AND ');
    const totalRow = db.get(`SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as sum, COALESCE(AVG(total), 0) as avg FROM orders WHERE ${where}`, params);

    const byStatus = db.all(`SELECT status, COUNT(*) as count FROM orders WHERE ${where} GROUP BY status`, params);

    return {
      totalOrders: totalRow?.count || 0,
      totalRevenue: totalRow?.sum || 0,
      avgOrder: totalRow?.avg || 0,
      byStatus,
    };
  }
}

export const ordersModel = new OrdersModel();
