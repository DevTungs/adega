import { promotionsModel } from './promotions.model';
import { AppError } from '../../shared/errors/app-error';
import { Promotion } from '../../shared/types';

export class PromotionsService {
  async getAll(filters?: { is_active?: boolean }) {
    return promotionsModel.findAll(filters);
  }

  async getById(id: string) {
    const promotion = promotionsModel.findById(id);
    if (!promotion) throw AppError.notFound('Promoção não encontrada');
    return promotion;
  }

  async getActive() {
    return promotionsModel.findActive();
  }

  async create(data: Partial<Promotion>) {
    return promotionsModel.create(data);
  }

  async update(id: string, data: Partial<Promotion>) {
    await this.getById(id);
    return promotionsModel.update(id, data);
  }

  async delete(id: string) {
    await this.getById(id);
    promotionsModel.delete(id);
  }
}

export const promotionsService = new PromotionsService();
