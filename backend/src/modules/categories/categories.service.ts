import { categoriesModel } from './categories.model';
import { AppError } from '../../shared/errors/app-error';
import { Category } from '../../shared/types';

export class CategoriesService {
  async getAll() {
    return categoriesModel.findAll();
  }

  async getById(id: string) {
    const category = await categoriesModel.findById(id);
    if (!category) throw AppError.notFound('Categoria não encontrada');
    return category;
  }

  async create(data: Partial<Category>) {
    const slug = data.slug || this.generateSlug(data.name!);
    const existing = await categoriesModel.findBySlug(slug);
    if (existing) throw AppError.conflict('Categoria com este slug já existe');
    return categoriesModel.create({ ...data, slug });
  }

  async update(id: string, data: Partial<Category>) {
    await this.getById(id);
    return categoriesModel.update(id, data);
  }

  async delete(id: string) {
    await this.getById(id);
    return categoriesModel.delete(id);
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

export const categoriesService = new CategoriesService();
