import { getDb, qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { StockMovement, StockMovementType } from '../../shared/types';

export class StockModel {
  createMovement(data: {
    product_id: string;
    type: StockMovementType;
    quantity: number;
    previous_stock: number;
    new_stock: number;
    reference_type?: string;
    reference_id?: string;
    notes?: string;
    created_by?: string;
  }): StockMovement {
    const id = uuid();
    const now = new Date().toISOString();
    qb.insert('stock_movements', {
      id,
      product_id: data.product_id,
      type: data.type,
      quantity: data.quantity,
      previous_stock: data.previous_stock,
      new_stock: data.new_stock,
      reference_type: data.reference_type || null,
      reference_id: data.reference_id || null,
      notes: data.notes || null,
      created_by: data.created_by || null,
      created_at: now,
    });
    return this.findById(id)!;
  }

  findById(id: string): StockMovement | undefined {
    return qb.selectOne('stock_movements', '*', 'id = ?', [id]) as StockMovement | undefined;
  }

  findAll(filters?: {
    product_id?: string;
    type?: StockMovementType;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): any[] {
    const db = getDb();
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.product_id) {
      conditions.push('sm.product_id = ?');
      params.push(filters.product_id);
    }
    if (filters?.type) {
      conditions.push('sm.type = ?');
      params.push(filters.type);
    }
    if (filters?.date_from) {
      conditions.push('sm.created_at >= ?');
      params.push(filters.date_from);
    }
    if (filters?.date_to) {
      conditions.push('sm.created_at <= ?');
      params.push(filters.date_to);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    return db.all(
      `SELECT sm.*, p.name as product_name, p.stock as current_stock
       FROM stock_movements sm
       LEFT JOIN products p ON p.id = sm.product_id
       ${where}
       ORDER BY sm.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
  }

  count(filters?: { product_id?: string; type?: StockMovementType }): number {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.product_id) {
      conditions.push('product_id = ?');
      params.push(filters.product_id);
    }
    if (filters?.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }

    const where = conditions.length > 0 ? conditions.join(' AND ') : undefined;
    return qb.count('stock_movements', where, params);
  }

  getSummary(): {
    total_entries_today: number;
    total_exits_today: number;
    inventory_value: number;
    low_stock_count: number;
  } {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const entries = db.get(
      `SELECT COALESCE(SUM(quantity), 0) as total FROM stock_movements WHERE type = 'entry' AND created_at >= ?`,
      [today]
    );
    const exits = db.get(
      `SELECT COALESCE(SUM(ABS(quantity)), 0) as total FROM stock_movements WHERE type IN ('sale', 'loss') AND created_at >= ?`,
      [today]
    );
    const inventory = db.get(
      `SELECT COALESCE(SUM(stock * COALESCE(cost_price, 0)), 0) as value FROM products WHERE is_active = 1`
    );
    const lowStock = db.get(
      `SELECT COUNT(*) as count FROM products WHERE is_active = 1 AND stock <= min_stock`
    );

    return {
      total_entries_today: entries?.total || 0,
      total_exits_today: exits?.total || 0,
      inventory_value: inventory?.value || 0,
      low_stock_count: lowStock?.count || 0,
    };
  }
}

export const stockModel = new StockModel();
