import { cashRegisterModel } from './cash-register.model';
import { AppError } from '../../shared/errors/app-error';

export class CashRegisterService {
  async getCurrent() {
    const open = cashRegisterModel.findOpen();
    if (!open) return null;
    return cashRegisterModel.getSummary(open.id);
  }

  async open(openedBy: string, openingAmount: number) {
    const existing = cashRegisterModel.findOpen();
    if (existing) {
      throw AppError.conflict('Já existe um caixa aberto');
    }
    const register = cashRegisterModel.open(openedBy, openingAmount);
    return cashRegisterModel.getSummary(register.id);
  }

  async close(id: string, closingAmount: number) {
    const register = cashRegisterModel.findById(id);
    if (!register) throw AppError.notFound('Caixa não encontrado');
    if (register.status !== 'open') throw AppError.badRequest('Caixa já está fechado');
    cashRegisterModel.close(id, closingAmount);
    return cashRegisterModel.getSummary(id);
  }

  async addMovement(type: 'sangria' | 'suprimento', amount: number, description?: string) {
    const open = cashRegisterModel.findOpen();
    if (!open) throw AppError.badRequest('Nenhum caixa aberto');
    cashRegisterModel.addMovement(open.id, type, amount, description);
    return cashRegisterModel.getSummary(open.id);
  }

  async addSaleMovement(orderId: string, amount: number, paymentMethod: string) {
    const open = cashRegisterModel.findOpen();
    if (!open) return; // No cash register open, skip silently
    cashRegisterModel.addMovement(open.id, 'sale', amount, undefined, paymentMethod, orderId);
  }

  async addReversalMovement(orderId: string, amount: number, paymentMethod: string) {
    const open = cashRegisterModel.findOpen();
    if (!open) return; // No cash register open, skip silently
    cashRegisterModel.addMovement(open.id, 'sangria', amount, `Estorno pedido #`, paymentMethod, orderId);
  }

  async getSummary(id: string) {
    const summary = cashRegisterModel.getSummary(id);
    if (!summary) throw AppError.notFound('Caixa não encontrado');
    return summary;
  }
}

export const cashRegisterService = new CashRegisterService();
