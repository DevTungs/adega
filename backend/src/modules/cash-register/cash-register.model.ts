import { getDb, qb } from '../../config/database';
import { v4 as uuid } from 'uuid';

export interface CashRegister {
  id: string;
  opened_by: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashMovement {
  id: string;
  cash_register_id: string;
  type: string;
  amount: number;
  description: string | null;
  payment_method: string | null;
  order_id: string | null;
  created_at: string;
}

export class CashRegisterModel {
  findOpen(): CashRegister | undefined {
    return qb.selectOne('cash_registers', '*', 'status = ?', ['open']) as CashRegister | undefined;
  }

  findById(id: string): CashRegister | undefined {
    return qb.selectOne('cash_registers', '*', 'id = ?', [id]) as CashRegister | undefined;
  }

  open(openedBy: string, openingAmount: number): CashRegister {
    const id = uuid();
    const now = new Date().toISOString();
    qb.insert('cash_registers', {
      id,
      opened_by: openedBy,
      opened_at: now,
      closed_at: null,
      opening_amount: openingAmount,
      closing_amount: null,
      status: 'open',
      notes: null,
      created_at: now,
      updated_at: now,
    });
    return this.findById(id)!;
  }

  close(id: string, closingAmount: number): void {
    const now = new Date().toISOString();
    qb.update('cash_registers', {
      closed_at: now,
      closing_amount: closingAmount,
      status: 'closed',
      updated_at: now,
    }, 'id = ?', [id]);
  }

  getSummary(id: string): any {
    const db = getDb();
    const register = this.findById(id);
    if (!register) return null;

    const sales = db.get(
      `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements WHERE cash_register_id = ? AND type = 'sale'`,
      [id]
    );
    const sangria = db.get(
      `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements WHERE cash_register_id = ? AND type = 'sangria'`,
      [id]
    );
    const suprimento = db.get(
      `SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements WHERE cash_register_id = ? AND type = 'suprimento'`,
      [id]
    );

    const salesByPayment = db.all(
      `SELECT payment_method, COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM cash_movements WHERE cash_register_id = ? AND type = 'sale'
       GROUP BY payment_method`,
      [id]
    );

    const movements = db.all(
      `SELECT * FROM cash_movements WHERE cash_register_id = ? ORDER BY created_at ASC`,
      [id]
    );

    const expectedClosing = register.opening_amount + sales.total + suprimento.total - sangria.total;

    return {
      register,
      opening_amount: register.opening_amount,
      total_sales: sales.total,
      total_sangria: sangria.total,
      total_suprimento: suprimento.total,
      expected_closing: expectedClosing,
      sales_by_payment: salesByPayment,
      movements,
    };
  }

  addMovement(cashRegisterId: string, type: string, amount: number, description?: string, paymentMethod?: string, orderId?: string): void {
    qb.insert('cash_movements', {
      id: uuid(),
      cash_register_id: cashRegisterId,
      type,
      amount,
      description: description || null,
      payment_method: paymentMethod || null,
      order_id: orderId || null,
      created_at: new Date().toISOString(),
    });
  }
}

export const cashRegisterModel = new CashRegisterModel();
