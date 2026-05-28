import { couponsModel } from './coupons.model';
import { AppError } from '../../shared/errors/app-error';
import { Coupon } from '../../shared/types';

export class CouponsService {
  async getAll(filters?: { is_active?: boolean }) {
    return couponsModel.findAll(filters);
  }

  async getById(id: string) {
    const coupon = couponsModel.findById(id);
    if (!coupon) throw AppError.notFound('Cupom não encontrado');
    return coupon;
  }

  async create(data: Partial<Coupon>) {
    const existing = couponsModel.findByCode(data.code!);
    if (existing) throw AppError.conflict('Cupom com este código já existe');
    return couponsModel.create(data);
  }

  async update(id: string, data: Partial<Coupon>) {
    await this.getById(id);
    if (data.code) {
      const existing = couponsModel.findByCode(data.code);
      if (existing && existing.id !== id) throw AppError.conflict('Cupom com este código já existe');
    }
    return couponsModel.update(id, data);
  }

  async delete(id: string) {
    await this.getById(id);
    couponsModel.delete(id);
  }

  async validate(code: string, orderTotal: number, customerId?: string) {
    const coupon = couponsModel.findByCode(code);
    if (!coupon) throw AppError.notFound('Cupom não encontrado ou inativo');

    const now = new Date().toISOString();
    if (now < coupon.start_date) throw AppError.badRequest('Cupom ainda não está válido');
    if (now > coupon.end_date) throw AppError.badRequest('Cupom expirado');
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) throw AppError.badRequest('Cupom atingiu o limite de uso');
    if (coupon.min_order_value && orderTotal < coupon.min_order_value) {
      throw AppError.badRequest(`Valor mínimo do pedido: R$ ${coupon.min_order_value.toFixed(2)}`);
    }

    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = orderTotal * (coupon.value / 100);
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = coupon.max_discount;
      }
    } else if (coupon.type === 'fixed') {
      discount = coupon.value;
    } else if (coupon.type === 'free_delivery') {
      discount = 0;
    }

    return {
      coupon,
      discount: Math.round(discount * 100) / 100,
      type: coupon.type,
    };
  }
}

export const couponsService = new CouponsService();
