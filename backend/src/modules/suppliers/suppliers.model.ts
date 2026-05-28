import { qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { Supplier } from '../../shared/types/supplier';

export class SuppliersModel {
  findAll(filters?: { is_active?: boolean; search?: string }): Supplier[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.is_active ? 1 : 0);
    }
    if (filters?.search) {
      conditions.push('(name LIKE ? OR cnpj LIKE ? OR phone LIKE ?)');
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    const where = conditions.length > 0 ? conditions.join(' AND ') : undefined;
    return qb.select('suppliers', '*', where, params) as Supplier[];
  }

  findById(id: string): Supplier | undefined {
    return qb.selectOne('suppliers', '*', 'id = ?', [id]) as Supplier | undefined;
  }

  create(data: Partial<Supplier>): Supplier {
    const id = data.id || uuid();
    const now = new Date().toISOString();
    qb.insert('suppliers', {
      id,
      name: data.name!,
      phone: data.phone || null,
      email: data.email || null,
      cnpj: data.cnpj || null,
      address: data.address || null,
      notes: data.notes || null,
      is_active: data.is_active !== undefined ? data.is_active : 1,
      created_at: now,
      updated_at: now,
    });
    return this.findById(id)!;
  }

  update(id: string, data: Partial<Supplier>): Supplier {
    qb.update('suppliers', { ...data, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findById(id)!;
  }

  delete(id: string): void {
    qb.update('suppliers', { is_active: 0, updated_at: new Date().toISOString() }, 'id = ?', [id]);
  }
}

export const suppliersModel = new SuppliersModel();
