import { getDb, qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { Customer } from '../../shared/types';

export class CustomersModel {
  findAll(filters?: { search?: string }): Customer[] {
    let where = 'is_blocked = 0';
    const params: any[] = [];

    if (filters?.search) {
      where += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    return qb.select('customers', '*', where, params) as Customer[];
  }

  findById(id: string): Customer | undefined {
    return qb.selectOne('customers', '*', 'id = ?', [id]) as Customer | undefined;
  }

  findByPhone(phone: string): Customer | undefined {
    return qb.selectOne('customers', '*', 'phone = ?', [phone]) as Customer | undefined;
  }

  create(data: Partial<Customer>): Customer {
    const id = data.id || uuid();
    const now = new Date().toISOString();
    qb.insert('customers', {
      id,
      phone: data.phone!,
      whatsapp_jid: data.whatsapp_jid || null,
      name: data.name || null,
      email: data.email || null,
      cpf: data.cpf || null,
      addresses: data.addresses || '[]',
      notes: data.notes || null,
      total_orders: 0,
      total_spent: 0,
      last_order_at: null,
      preferences: '{}',
      tags: '[]',
      is_blocked: 0,
      created_at: now,
      updated_at: now,
    });
    return this.findById(id)!;
  }

  update(id: string, data: Partial<Customer>): Customer {
    qb.update('customers', { ...data, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findById(id)!;
  }

  updateOrderStats(id: string, total: number): void {
    const db = getDb();
    db.run(
      `UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ?, last_order_at = ?, updated_at = ? WHERE id = ?`,
      [total, new Date().toISOString(), new Date().toISOString(), id]
    );
  }

  getOrCreateByPhone(phone: string): Customer {
    let customer = this.findByPhone(phone);
    if (!customer) {
      customer = this.create({ phone });
    }
    return customer;
  }

  getOrders(customerId: string, limit: number = 10): any[] {
    const db = getDb();
    return db.all(
      `SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?`,
      [customerId, limit]
    );
  }
}

export const customersModel = new CustomersModel();
