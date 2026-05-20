import { customersModel } from './customers.model';
import { AppError } from '../../shared/errors/app-error';
import { Customer } from '../../shared/types';

export class CustomersService {
  async getAll(filters?: { search?: string }) {
    return customersModel.findAll(filters);
  }

  async getById(id: string) {
    const customer = await customersModel.findById(id);
    if (!customer) throw AppError.notFound('Cliente não encontrado');
    return customer;
  }

  async getByPhone(phone: string) {
    return customersModel.findByPhone(phone);
  }

  async getOrCreateByPhone(phone: string) {
    return customersModel.getOrCreateByPhone(phone);
  }

  async update(id: string, data: Partial<Customer>) {
    await this.getById(id);
    return customersModel.update(id, data);
  }

  async getOrders(customerId: string, limit?: number) {
    await this.getById(customerId);
    return customersModel.getOrders(customerId, limit);
  }
}

export const customersService = new CustomersService();
