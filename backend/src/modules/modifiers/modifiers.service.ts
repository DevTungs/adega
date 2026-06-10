import { modifiersModel } from './modifiers.model';
import { AppError } from '../../shared/errors/app-error';
import { ProductModifier, ModifierOption } from '../../shared/types';
import { cacheService } from '../../services/cache/cache.service';

export class ModifiersService {
  async getByProduct(productId: string) {
    const modifiers = await modifiersModel.findByProduct(productId);
    for (const mod of modifiers) {
      (mod as any).options = await modifiersModel.findOptions(mod.id);
    }
    return modifiers;
  }

  async getById(id: string) {
    const mod = await modifiersModel.findById(id);
    if (!mod) throw AppError.notFound('Modificador não encontrado');
    (mod as any).options = await modifiersModel.findOptions(mod.id);
    return mod;
  }

  async create(data: Partial<ProductModifier>) {
    const mod = await modifiersModel.create(data);
    cacheService.invalidateCatalog();
    return mod;
  }

  async update(id: string, data: Partial<ProductModifier>) {
    await this.getById(id);
    const mod = await modifiersModel.update(id, data);
    cacheService.invalidateCatalog();
    return mod;
  }

  async delete(id: string) {
    await this.getById(id);
    await modifiersModel.delete(id);
    cacheService.invalidateCatalog();
  }

  // Options
  async getOptions(modifierId: string) {
    await this.getById(modifierId);
    return modifiersModel.findOptions(modifierId);
  }

  async getOptionById(id: string) {
    const opt = await modifiersModel.findOptionById(id);
    if (!opt) throw AppError.notFound('Opção não encontrada');
    return opt;
  }

  async createOption(data: Partial<ModifierOption>) {
    const opt = await modifiersModel.createOption(data);
    cacheService.invalidateCatalog();
    return opt;
  }

  async updateOption(id: string, data: Partial<ModifierOption>) {
    await this.getOptionById(id);
    const opt = await modifiersModel.updateOption(id, data);
    cacheService.invalidateCatalog();
    return opt;
  }

  async deleteOption(id: string) {
    await this.getOptionById(id);
    await modifiersModel.deleteOption(id);
    cacheService.invalidateCatalog();
  }
}

export const modifiersService = new ModifiersService();
