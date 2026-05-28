import { productsModel } from './products.model';
import { stockModel } from '../stock/stock.model';
import { AppError } from '../../shared/errors/app-error';
import { Product } from '../../shared/types';
import { cacheService } from '../../services/cache/cache.service';
import { emitStockLow } from '../../services/websocket/ws.server';

export class ProductsService {
  async getAll(filters?: { category_id?: string; is_active?: boolean; search?: string }) {
    return productsModel.findAll(filters);
  }

  async getById(id: string) {
    const product = await productsModel.findById(id);
    if (!product) throw AppError.notFound('Produto não encontrado');
    return product;
  }

  async create(data: Partial<Product>) {
    const slug = data.slug || this.generateSlug(data.name!);
    const existing = await productsModel.findBySlug(slug);
    if (existing) throw AppError.conflict('Produto com este slug já existe');
    const product = await productsModel.create({ ...data, slug });
    cacheService.invalidateCatalog();
    return product;
  }

  async update(id: string, data: Partial<Product>) {
    await this.getById(id);
    const product = await productsModel.update(id, data);
    cacheService.invalidateCatalog();
    return product;
  }

  async delete(id: string) {
    await this.getById(id);
    await productsModel.delete(id);
    cacheService.invalidateCatalog();
  }

  async updateStock(id: string, quantity: number, created_by?: string) {
    const product = await this.getById(id);
    const previousStock = product.stock;
    await productsModel.updateStock(id, quantity);
    stockModel.createMovement({
      product_id: id,
      type: 'adjustment',
      quantity,
      previous_stock: previousStock,
      new_stock: previousStock + quantity,
      reference_type: 'manual',
      created_by: created_by || 'admin',
    });
    const updated = await productsModel.findById(id);
    if (updated && updated.stock <= updated.min_stock) {
      try {
        emitStockLow({ id: updated.id, name: updated.name, stock: updated.stock, min_stock: updated.min_stock });
      } catch { /* WS not critical */ }
    }
  }

  async getCatalog() {
    const cached = cacheService.getCatalog();
    if (cached) return cached;

    const rows = await productsModel.getCatalog();
    const catalog = this.groupCatalog(rows);
    cacheService.setCatalog(catalog);
    return catalog;
  }

  async searchByAlias(query: string) {
    return productsModel.findByAlias(query);
  }

  async findByBarcode(barcode: string) {
    const localProduct = productsModel.findByBarcode(barcode);
    if (localProduct) {
      return { found: true, source: 'local' as const, product: localProduct };
    }

    const { lookupBarcode } = await import('./open-food-facts');
    const offResult = await lookupBarcode(barcode);

    if (offResult.found) {
      return {
        found: true,
        source: 'api' as const,
        product: {
          barcode,
          name: offResult.product_name || '',
          brand: offResult.brands || '',
          volume: offResult.quantity || '',
          image_url: offResult.image_url || '',
          description: offResult.categories || '',
        },
      };
    }

    return { found: false };
  }

  private groupCatalog(rows: any[]) {
    const groups: Record<string, any> = {};
    for (const row of rows) {
      if (!groups[row.category_id]) {
        groups[row.category_id] = {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
          display_order: row.category_order,
          products: [],
        };
      }
      groups[row.category_id].products.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        price: row.price,
        promo_price: row.promo_price,
        image_url: row.image_url,
        stock: row.stock,
        unit: row.unit,
        volume: row.volume,
        brand: row.brand,
        is_featured: row.is_featured,
      });
    }
    return Object.values(groups).sort((a: any, b: any) => a.display_order - b.display_order);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}

export const productsService = new ProductsService();
