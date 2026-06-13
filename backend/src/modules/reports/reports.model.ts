import { getDb } from '../../config/database';

export class ReportsModel {
  getSalesSummary(filters: { date_from?: string; date_to?: string; order_type?: string }) {
    const db = getDb();
    const conditions = ["status != 'cancelled'"];
    const params: any[] = [];

    if (filters.date_from) { conditions.push('created_at >= ?'); params.push(filters.date_from); }
    if (filters.date_to) { conditions.push('created_at <= ?'); params.push(filters.date_to); }
    if (filters.order_type) { conditions.push('order_type = ?'); params.push(filters.order_type); }

    const where = conditions.join(' AND ');
    const row = db.get(
      `SELECT COUNT(*) as totalOrders, COALESCE(SUM(total), 0) as totalRevenue, COALESCE(AVG(total), 0) as avgTicket FROM orders WHERE ${where}`,
      params
    );
    return row;
  }

  getSalesByPeriod(period: string, filters: { date_from?: string; date_to?: string; order_type?: string }) {
    const db = getDb();
    const conditions = ["status != 'cancelled'"];
    const params: any[] = [];

    if (filters.date_from) { conditions.push('created_at >= ?'); params.push(filters.date_from); }
    if (filters.date_to) { conditions.push('created_at <= ?'); params.push(filters.date_to); }
    if (filters.order_type) { conditions.push('order_type = ?'); params.push(filters.order_type); }

    const groupExpr: Record<string, string> = {
      day: "strftime('%Y-%m-%d', created_at)",
      week: "strftime('%Y-W%W', created_at)",
      month: "strftime('%Y-%m', created_at)",
      year: "strftime('%Y', created_at)",
    };

    const group = groupExpr[period] || groupExpr.day;
    const where = conditions.join(' AND ');

    return db.all(
      `SELECT ${group} as period, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue FROM orders WHERE ${where} GROUP BY period ORDER BY period`,
      params
    );
  }

  getSalesByPaymentMethod(filters: { date_from?: string; date_to?: string; order_type?: string }) {
    const db = getDb();
    const conditions = ["status != 'cancelled'"];
    const params: any[] = [];

    if (filters.date_from) { conditions.push('created_at >= ?'); params.push(filters.date_from); }
    if (filters.date_to) { conditions.push('created_at <= ?'); params.push(filters.date_to); }
    if (filters.order_type) { conditions.push('order_type = ?'); params.push(filters.order_type); }

    const where = conditions.join(' AND ');
    return db.all(
      `SELECT payment_method, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue FROM orders WHERE ${where} GROUP BY payment_method ORDER BY revenue DESC`,
      params
    );
  }

  getTopProducts(limit: number, sort: string, filters: { date_from?: string; date_to?: string; order_type?: string }) {
    const db = getDb();
    const conditions = ["o.status != 'cancelled'"];
    const params: any[] = [];

    if (filters.date_from) { conditions.push('o.created_at >= ?'); params.push(filters.date_from); }
    if (filters.date_to) { conditions.push('o.created_at <= ?'); params.push(filters.date_to); }
    if (filters.order_type) { conditions.push('o.order_type = ?'); params.push(filters.order_type); }

    const where = conditions.join(' AND ');
    const orderCol = sort === 'revenue' ? 'revenue' : 'quantity';

    return db.all(
      `SELECT oi.product_id, oi.product_name, SUM(oi.quantity) as quantity, SUM(oi.total_price) as revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE ${where}
       GROUP BY oi.product_id, oi.product_name
       ORDER BY ${orderCol} DESC
       LIMIT ?`,
      [...params, limit]
    );
  }

  getSalesByCategory(filters: { date_from?: string; date_to?: string; order_type?: string }) {
    const db = getDb();
    const conditions = ["o.status != 'cancelled'"];
    const params: any[] = [];

    if (filters.date_from) { conditions.push('o.created_at >= ?'); params.push(filters.date_from); }
    if (filters.date_to) { conditions.push('o.created_at <= ?'); params.push(filters.date_to); }
    if (filters.order_type) { conditions.push('o.order_type = ?'); params.push(filters.order_type); }

    const where = conditions.join(' AND ');
    return db.all(
      `SELECT c.name as category_name, SUM(oi.quantity) as quantity, SUM(oi.total_price) as revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE ${where}
       GROUP BY c.id, c.name
       ORDER BY revenue DESC`,
      params
    );
  }

  getTopCustomers(limit: number, orderType?: string) {
    const db = getDb();
    const conditions = ['total_orders > 0'];
    const params: any[] = [limit];

    if (orderType) {
      return db.all(
        `SELECT c.id, c.name, c.phone, COUNT(o.id) as total_orders, COALESCE(SUM(o.total), 0) as total_spent, MAX(o.created_at) as last_order_at
         FROM customers c
         JOIN orders o ON o.customer_id = c.id
         WHERE o.order_type = ? AND o.status != 'cancelled'
         GROUP BY c.id, c.name, c.phone
         ORDER BY total_spent DESC
         LIMIT ?`,
        [orderType, limit]
      );
    }

    return db.all(
      `SELECT id, name, phone, total_orders, total_spent, last_order_at
       FROM customers
       WHERE ${conditions.join(' AND ')}
       ORDER BY total_spent DESC
       LIMIT ?`,
      params
    );
  }

  getInventoryValuation() {
    const db = getDb();
    return db.get(
      `SELECT COUNT(*) as totalProducts, COALESCE(SUM(stock), 0) as totalUnits, COALESCE(SUM(COALESCE(cost_price, 0) * stock), 0) as totalValue FROM products WHERE is_active = 1`
    );
  }

  getLowStockProducts() {
    const db = getDb();
    return db.all(
      `SELECT p.id, p.name, p.stock, p.min_stock, p.unit, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1 AND p.stock <= p.min_stock
       ORDER BY p.stock ASC`
    );
  }

  getInventoryByCategory() {
    const db = getDb();
    return db.all(
      `SELECT c.name as category_name, COUNT(p.id) as products, SUM(p.stock) as total_stock, SUM(COALESCE(p.cost_price, 0) * p.stock) as value
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1
       GROUP BY c.id, c.name
       ORDER BY c.name`
    );
  }

  getProfit(filters: { date_from?: string; date_to?: string; order_type?: string }) {
    const db = getDb();
    const conditions = ["o.status != 'cancelled'"];
    const params: any[] = [];

    if (filters.date_from) { conditions.push('o.created_at >= ?'); params.push(filters.date_from); }
    if (filters.date_to) { conditions.push('o.created_at <= ?'); params.push(filters.date_to); }
    if (filters.order_type) { conditions.push('o.order_type = ?'); params.push(filters.order_type); }

    const where = conditions.join(' AND ');
    return db.get(
      `SELECT COALESCE(SUM(oi.total_price), 0) as revenue, COALESCE(SUM(COALESCE(p.cost_price, 0) * oi.quantity), 0) as cost
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE ${where}`,
      params
    );
  }

  getOrdersByHour(filters: { date_from?: string; date_to?: string; order_type?: string }) {
    const db = getDb();
    const conditions = ["status != 'cancelled'"];
    const params: any[] = [];

    if (filters.date_from) { conditions.push('created_at >= ?'); params.push(filters.date_from); }
    if (filters.date_to) { conditions.push('created_at <= ?'); params.push(filters.date_to); }
    if (filters.order_type) { conditions.push('order_type = ?'); params.push(filters.order_type); }

    const where = conditions.join(' AND ');
    return db.all(
      `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue
       FROM orders WHERE ${where}
       GROUP BY hour ORDER BY hour`,
      params
    );
  }

  getComparison(filters: { date_from?: string; date_to?: string; order_type?: string }) {
    if (!filters.date_from || !filters.date_to) return null;

    const db = getDb();
    const from = new Date(filters.date_from);
    const to = new Date(filters.date_to);
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

    const prevFrom = new Date(from);
    prevFrom.setDate(prevFrom.getDate() - daysDiff);
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);

    const orderTypeCondition = filters.order_type ? ' AND order_type = ?' : '';
    const currentParams = filters.order_type
      ? [filters.date_from, filters.date_to, filters.order_type]
      : [filters.date_from, filters.date_to];
    const previousParams = filters.order_type
      ? [prevFrom.toISOString(), prevTo.toISOString(), filters.order_type]
      : [prevFrom.toISOString(), prevTo.toISOString()];

    const current = db.get(
      `SELECT COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'cancelled' AND created_at >= ? AND created_at <= ?${orderTypeCondition}`,
      currentParams
    );

    const previous = db.get(
      `SELECT COUNT(*) as orders, COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'cancelled' AND created_at >= ? AND created_at <= ?${orderTypeCondition}`,
      previousParams
    );

    return { current, previous, daysDiff };
  }
}

export const reportsModel = new ReportsModel();
