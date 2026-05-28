import { getDb, qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { Coupon } from '../../shared/types';

export class CouponsModel {
  findAll(filters?: { is_active?: boolean }): Coupon[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.is_active ? 1 : 0);
    }

    const where = conditions.length > 0 ? conditions.join(' AND ') : undefined;
    return qb.select('coupons', '*', where, params) as Coupon[];
  }

  findById(id: string): Coupon | undefined {
    return qb.selectOne('coupons', '*', 'id = ?', [id]) as Coupon | undefined;
  }

  findByCode(code: string): Coupon | undefined {
    return qb.selectOne('coupons', '*', 'code = ? AND is_active = 1', [code.toUpperCase()]) as Coupon | undefined;
  }

  create(data: Partial<Coupon>): Coupon {
    const id = data.id || uuid();
    const now = new Date().toISOString();
    qb.insert('coupons', {
      id,
      code: data.code!.toUpperCase(),
      description: data.description || null,
      type: data.type!,
      value: data.value!,
      min_order_value: data.min_order_value || null,
      max_discount: data.max_discount || null,
      max_uses: data.max_uses || null,
      current_uses: 0,
      per_customer: data.per_customer !== undefined ? data.per_customer : 1,
      start_date: data.start_date!,
      end_date: data.end_date!,
      is_active: data.is_active !== undefined ? data.is_active : 1,
      created_at: now,
      updated_at: now,
    });
    return this.findById(id)!;
  }

  update(id: string, data: Partial<Coupon>): Coupon {
    if (data.code) data.code = data.code.toUpperCase();
    qb.update('coupons', { ...data, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findById(id)!;
  }

  delete(id: string): void {
    qb.update('coupons', { is_active: 0, updated_at: new Date().toISOString() }, 'id = ?', [id]);
  }

  incrementUsage(id: string): void {
    const db = getDb();
    db.run('UPDATE coupons SET current_uses = current_uses + 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
  }
}

export const couponsModel = new CouponsModel();
