import { stockModel } from './stock.model';
import { productsModel } from '../products/products.model';
import { AppError } from '../../shared/errors/app-error';
import { StockMovementType } from '../../shared/types';
import { getDb } from '../../config/database';

export class StockService {
  async getAll(filters?: {
    product_id?: string;
    type?: StockMovementType;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }) {
    const [movements, total] = await Promise.all([
      stockModel.findAll(filters),
      stockModel.count(filters),
    ]);
    return { movements, total };
  }

  async getByProduct(productId: string) {
    const product = await productsModel.findById(productId);
    if (!product) throw AppError.notFound('Produto não encontrado');
    const movements = stockModel.findAll({ product_id: productId });
    return { product, movements };
  }

  async getSummary() {
    return stockModel.getSummary();
  }

  async receiveStock(data: {
    product_id: string;
    quantity: number;
    cost_price?: number;
    supplier_name?: string;
    notes?: string;
    invoice_number?: string;
    created_by?: string;
  }) {
    const product = await productsModel.findById(data.product_id);
    if (!product) throw AppError.notFound('Produto não encontrado');
    if (data.quantity <= 0) throw AppError.badRequest('Quantidade deve ser positiva');

    const previousStock = product.stock;
    const newStock = previousStock + data.quantity;

    // Update product stock and optionally cost_price
    const updateData: any = {};
    if (data.cost_price !== undefined) {
      updateData.cost_price = data.cost_price;
    }
    productsModel.updateStock(data.product_id, data.quantity);
    if (Object.keys(updateData).length > 0) {
      productsModel.update(data.product_id, updateData);
    }

    // Record movement
    const movementNotes = [
      data.supplier_name ? `Fornecedor: ${data.supplier_name}` : null,
      data.invoice_number ? `NF: ${data.invoice_number}` : null,
      data.notes,
    ].filter(Boolean).join(' | ');

    const movement = stockModel.createMovement({
      product_id: data.product_id,
      type: 'entry',
      quantity: data.quantity,
      previous_stock: previousStock,
      new_stock: newStock,
      reference_type: 'purchase',
      notes: movementNotes || undefined,
      created_by: data.created_by,
    });

    return { movement, product: productsModel.findById(data.product_id) };
  }

  async recordMovement(data: {
    product_id: string;
    type: StockMovementType;
    quantity: number;
    reference_type?: string;
    reference_id?: string;
    notes?: string;
    created_by?: string;
  }) {
    const product = await productsModel.findById(data.product_id);
    if (!product) throw AppError.notFound('Produto não encontrado');

    const previousStock = product.stock;
    const delta = data.type === 'entry' ? Math.abs(data.quantity) : -Math.abs(data.quantity);
    const newStock = previousStock + delta;

    productsModel.updateStock(data.product_id, delta);

    return stockModel.createMovement({
      ...data,
      quantity: delta,
      previous_stock: previousStock,
      new_stock: newStock,
    });
  }
}

export const stockService = new StockService();
