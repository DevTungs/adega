import { driversModel } from './drivers.model';
import { AppError } from '../../shared/errors/app-error';
import { DeliveryDriver } from '../../shared/types';

export class DriversService {
  async getAll(filters?: { is_active?: boolean }) {
    return driversModel.findAll(filters);
  }

  async getById(id: string) {
    const driver = driversModel.findById(id);
    if (!driver) throw AppError.notFound('Motorista não encontrado');
    return driver;
  }

  async create(data: Partial<DeliveryDriver>) {
    const existing = driversModel.findByPhone(data.phone!);
    if (existing) throw AppError.conflict('Motorista com este telefone já existe');
    return driversModel.create(data);
  }

  async update(id: string, data: Partial<DeliveryDriver>) {
    await this.getById(id);
    if (data.phone) {
      const existing = driversModel.findByPhone(data.phone);
      if (existing && existing.id !== id) throw AppError.conflict('Motorista com este telefone já existe');
    }
    return driversModel.update(id, data);
  }

  async delete(id: string) {
    await this.getById(id);
    driversModel.delete(id);
  }

  async toggleAvailability(id: string) {
    await this.getById(id);
    return driversModel.toggleAvailability(id);
  }
}

export const driversService = new DriversService();
