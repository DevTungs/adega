import { settingsAgent } from '../settings/settings.service';
import { AppError } from '../../shared/errors/app-error';

export interface ValidationResult {
  valid: boolean;
  subtotal: number;
  deliveryFee: number;
  total: number;
  minOrder: number;
  meetsMinimum: boolean;
  shortfall: number;
  errors: string[];
  warnings: string[];
}

export class OrderValidatorAgent {
  validate(data: {
    items: Array<{ quantity: number; unit_price: number }>;
    order_type?: string;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const subtotal = data.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const orderType = data.order_type || 'delivery';

    if (subtotal <= 0) {
      errors.push('Subtotal do pedido deve ser maior que zero');
    }

    const { deliveryFee, minOrder, meetsMinimum, shortfall } = settingsAgent.getDeliveryPricing(orderType, subtotal);

    if (orderType === 'delivery' && minOrder > 0 && !meetsMinimum) {
      errors.push(`Pedido mínimo é R$ ${minOrder.toFixed(2)}. Faltam R$ ${shortfall.toFixed(2)}`);
    }

    const total = subtotal + deliveryFee;

    return {
      valid: errors.length === 0,
      subtotal,
      deliveryFee,
      total,
      minOrder,
      meetsMinimum,
      shortfall,
      errors,
      warnings,
    };
  }

  validateOrThrow(data: {
    items: Array<{ quantity: number; unit_price: number }>;
    order_type?: string;
  }): Required<Omit<ValidationResult, 'warnings' | 'valid' | 'errors'>> & { warnings: string[] } {
    const result = this.validate(data);

    if (!result.valid) {
      throw AppError.badRequest(result.errors.join('. '));
    }

    return {
      subtotal: result.subtotal,
      deliveryFee: result.deliveryFee,
      total: result.total,
      minOrder: result.minOrder,
      meetsMinimum: result.meetsMinimum,
      shortfall: result.shortfall,
      warnings: result.warnings,
    };
  }
}

export const orderValidator = new OrderValidatorAgent();
