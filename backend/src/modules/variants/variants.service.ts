import { variantsModel } from './variants.model';
import { AppError } from '../../shared/errors/app-error';
import { ProductVariant } from '../../shared/types';
import { cacheService } from '../../services/cache/cache.service';

export class VariantsService {
  async getByProduct(productId: string) {
    return variantsModel.findByProduct(productId);
  }

  async getById(id: string) {
    const variant = await variantsModel.findById(id);
    if (!variant) throw AppError.notFound('Variação não encontrada');
    return variant;
  }

  async create(data: Partial<ProductVariant>) {
    const variant = await variantsModel.create(data);
    cacheService.invalidateCatalog();
    return variant;
  }

  async update(id: string, data: Partial<ProductVariant>) {
    await this.getById(id);
    const variant = await variantsModel.update(id, data);
    cacheService.invalidateCatalog();
    return variant;
  }

  async delete(id: string) {
    await this.getById(id);
    await variantsModel.delete(id);
    cacheService.invalidateCatalog();
  }

  async updateStock(id: string, quantity: number) {
    await this.getById(id);
    await variantsModel.updateStock(id, quantity);
    cacheService.invalidateCatalog();
  }
}

export const variantsService = new VariantsService();
