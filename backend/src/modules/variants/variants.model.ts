import { getDb, qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { ProductVariant } from '../../shared/types';

export class VariantsModel {
  findByProduct(productId: string, onlyActive: boolean = true): ProductVariant[] {
    const where = onlyActive ? 'product_id = ? AND is_active = 1' : 'product_id = ?';
    return qb.select('product_variants', '*', where, [productId]) as ProductVariant[];
  }

  findById(id: string): ProductVariant | undefined {
    return qb.selectOne('product_variants', '*', 'id = ?', [id]) as ProductVariant | undefined;
  }

  findByBarcode(barcode: string): ProductVariant | undefined {
    return qb.selectOne('product_variants', '*', 'barcode = ? AND is_active = 1', [barcode]) as ProductVariant | undefined;
  }

  create(data: Partial<ProductVariant>): ProductVariant {
    const id = data.id || uuid();
    const now = new Date().toISOString();
    qb.insert('product_variants', {
      id,
      product_id: data.product_id!,
      name: data.name!,
      description: data.description || null,
      price: data.price!,
      promo_price: data.promo_price || null,
      stock: data.stock ?? null,
      barcode: data.barcode || null,
      sort_order: data.sort_order || 0,
      is_active: data.is_active !== undefined ? data.is_active : 1,
      created_at: now,
      updated_at: now,
    });
    return this.findById(id)!;
  }

  update(id: string, data: Partial<ProductVariant>): ProductVariant {
    qb.update('product_variants', { ...data, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findById(id)!;
  }

  delete(id: string): void {
    qb.update('product_variants', { is_active: 0, updated_at: new Date().toISOString() }, 'id = ?', [id]);
  }

  updateStock(id: string, quantity: number): void {
    getDb().run(
      'UPDATE product_variants SET stock = COALESCE(stock, 0) + ?, updated_at = ? WHERE id = ?',
      [quantity, new Date().toISOString(), id]
    );
  }
}

export const variantsModel = new VariantsModel();
