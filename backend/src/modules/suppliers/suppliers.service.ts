import { suppliersModel } from './suppliers.model';
import { AppError } from '../../shared/errors/app-error';
import { Supplier } from '../../shared/types/supplier';

export class SuppliersService {
  async getAll(filters?: { is_active?: boolean; search?: string }) {
    return suppliersModel.findAll(filters);
  }

  async getById(id: string) {
    const supplier = suppliersModel.findById(id);
    if (!supplier) throw AppError.notFound('Fornecedor não encontrado');
    return supplier;
  }

  async create(data: Partial<Supplier>) {
    return suppliersModel.create(data);
  }

  async update(id: string, data: Partial<Supplier>) {
    await this.getById(id);
    return suppliersModel.update(id, data);
  }

  async delete(id: string) {
    await this.getById(id);
    suppliersModel.delete(id);
  }
}

export const suppliersService = new SuppliersService();
