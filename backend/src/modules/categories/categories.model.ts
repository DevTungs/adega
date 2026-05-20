import { getDb, qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { Category } from '../../shared/types';

export class CategoriesModel {
  findAll(): Category[] {
    return qb.select('categories', '*', 'is_active = 1', []) as Category[];
  }

  findById(id: string): Category | undefined {
    return qb.selectOne('categories', '*', 'id = ?', [id]) as Category | undefined;
  }

  findBySlug(slug: string): Category | undefined {
    return qb.selectOne('categories', '*', 'slug = ?', [slug]) as Category | undefined;
  }

  create(data: Partial<Category>): Category {
    const id = data.id || uuid();
    const now = new Date().toISOString();
    qb.insert('categories', {
      id,
      name: data.name!,
      slug: data.slug!,
      description: data.description || null,
      image_url: data.image_url || null,
      display_order: data.display_order || 0,
      is_active: 1,
      created_at: now,
      updated_at: now,
    });
    return this.findById(id)!;
  }

  update(id: string, data: Partial<Category>): Category {
    qb.update('categories', { ...data, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findById(id)!;
  }

  delete(id: string): void {
    qb.update('categories', { is_active: 0, updated_at: new Date().toISOString() }, 'id = ?', [id]);
  }
}

export const categoriesModel = new CategoriesModel();
