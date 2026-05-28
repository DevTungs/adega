import { qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { Promotion } from '../../shared/types';

export class PromotionsModel {
  findAll(filters?: { is_active?: boolean }): Promotion[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.is_active ? 1 : 0);
    }

    const where = conditions.length > 0 ? conditions.join(' AND ') : undefined;
    return qb.select('promotions', '*', where, params) as Promotion[];
  }

  findById(id: string): Promotion | undefined {
    return qb.selectOne('promotions', '*', 'id = ?', [id]) as Promotion | undefined;
  }

  findActive(): Promotion[] {
    const now = new Date().toISOString();
    return qb.select('promotions', '*', 'is_active = 1 AND start_date <= ? AND end_date >= ?', [now, now]) as Promotion[];
  }

  create(data: Partial<Promotion>): Promotion {
    const id = data.id || uuid();
    const now = new Date().toISOString();
    qb.insert('promotions', {
      id,
      name: data.name!,
      description: data.description || null,
      type: data.type!,
      value: data.value || null,
      min_order_value: data.min_order_value || null,
      min_quantity: data.min_quantity || null,
      applicable_products: data.applicable_products || '[]',
      applicable_categories: data.applicable_categories || '[]',
      buy_quantity: data.buy_quantity || null,
      get_quantity: data.get_quantity || null,
      start_date: data.start_date!,
      end_date: data.end_date!,
      is_active: data.is_active !== undefined ? data.is_active : 1,
      max_uses: data.max_uses || null,
      current_uses: 0,
      created_at: now,
      updated_at: now,
    });
    return this.findById(id)!;
  }

  update(id: string, data: Partial<Promotion>): Promotion {
    qb.update('promotions', { ...data, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findById(id)!;
  }

  delete(id: string): void {
    qb.update('promotions', { is_active: 0, updated_at: new Date().toISOString() }, 'id = ?', [id]);
  }
}

export const promotionsModel = new PromotionsModel();
