import { getDb, qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { Product } from '../../shared/types';

export class ProductsModel {
  findAll(filters?: { category_id?: string; is_active?: boolean; search?: string }): Product[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.category_id) {
      conditions.push('category_id = ?');
      params.push(filters.category_id);
    }
    if (filters?.is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.is_active ? 1 : 0);
    }
    if (filters?.search) {
      conditions.push('(name LIKE ? OR brand LIKE ? OR description LIKE ?)');
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    const where = conditions.length > 0 ? conditions.join(' AND ') : undefined;
    return qb.select('products', '*', where, params) as Product[];
  }

  findById(id: string): Product | undefined {
    return qb.selectOne('products', '*', 'id = ?', [id]) as Product | undefined;
  }

  findBySlug(slug: string): Product | undefined {
    return qb.selectOne('products', '*', 'slug = ?', [slug]) as Product | undefined;
  }

  findByAlias(alias: string): Product | undefined {
    const db = getDb();
    const row = db.get(
      `SELECT p.* FROM product_aliases pa
       JOIN products p ON p.id = pa.product_id
       WHERE pa.alias LIKE ? AND p.is_active = 1
       LIMIT 1`,
      [`%${alias}%`]
    );
    return row as Product | undefined;
  }

  findAllAliases(): Map<string, Product> {
    const db = getDb();
    const rows = db.all(
      `SELECT pa.alias, p.* FROM product_aliases pa
       JOIN products p ON p.id = pa.product_id
       WHERE p.is_active = 1`
    );
    const map = new Map<string, Product>();
    for (const row of rows) {
      const alias = (row as any).alias as string;
      const { alias: _, ...product } = row as any;
      map.set(alias.toLowerCase(), product as Product);
    }
    return map;
  }

  create(data: Partial<Product>): Product {
    const id = data.id || uuid();
    const now = new Date().toISOString();
    qb.insert('products', {
      id,
      category_id: data.category_id,
      name: data.name!,
      slug: data.slug!,
      description: data.description || null,
      price: data.price!,
      promo_price: data.promo_price || null,
      cost_price: data.cost_price || null,
      image_url: data.image_url || null,
      barcode: data.barcode || null,
      stock: data.stock || 0,
      min_stock: data.min_stock || 5,
      unit: data.unit || 'un',
      volume: data.volume || null,
      brand: data.brand || null,
      is_active: data.is_active !== undefined ? data.is_active : 1,
      is_featured: data.is_featured || 0,
      display_order: data.display_order || 0,
      metadata: data.metadata || '{}',
      created_at: now,
      updated_at: now,
    });
    return this.findById(id)!;
  }

  update(id: string, data: Partial<Product>): Product {
    qb.update('products', { ...data, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findById(id)!;
  }

  delete(id: string): void {
    qb.update('products', { is_active: 0, updated_at: new Date().toISOString() }, 'id = ?', [id]);
  }

  updateStock(id: string, quantity: number): void {
    const db = getDb();
    db.run('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?', [quantity, new Date().toISOString(), id]);
  }

  getCatalog(): any[] {
    const db = getDb();
    return db.all(
      `SELECT c.id as category_id, c.name as category_name, c.slug as category_slug, c.display_order as category_order,
              p.*
       FROM categories c
       JOIN products p ON p.category_id = c.id
       WHERE c.is_active = 1 AND p.is_active = 1
       ORDER BY c.display_order ASC, p.display_order ASC, p.name ASC`
    );
  }
}

export const productsModel = new ProductsModel();
