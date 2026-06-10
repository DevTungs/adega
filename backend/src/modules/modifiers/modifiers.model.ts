import { qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { ProductModifier, ModifierOption } from '../../shared/types';

export class ModifiersModel {
  findByProduct(productId: string, onlyActive: boolean = true): ProductModifier[] {
    const where = onlyActive ? 'product_id = ? AND is_active = 1' : 'product_id = ?';
    return qb.select('product_modifiers', '*', where, [productId]) as ProductModifier[];
  }

  findById(id: string): ProductModifier | undefined {
    return qb.selectOne('product_modifiers', '*', 'id = ?', [id]) as ProductModifier | undefined;
  }

  create(data: Partial<ProductModifier>): ProductModifier {
    const id = data.id || uuid();
    const now = new Date().toISOString();
    qb.insert('product_modifiers', {
      id,
      product_id: data.product_id!,
      name: data.name!,
      type: data.type || 'single',
      min_select: data.min_select || 0,
      max_select: data.max_select || 1,
      sort_order: data.sort_order || 0,
      is_active: data.is_active !== undefined ? data.is_active : 1,
      creates_splits: data.creates_splits !== undefined ? data.creates_splits : 0,
      created_at: now,
      updated_at: now,
    });
    return this.findById(id)!;
  }

  update(id: string, data: Partial<ProductModifier>): ProductModifier {
    qb.update('product_modifiers', { ...data, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findById(id)!;
  }

  delete(id: string): void {
    qb.update('product_modifiers', { is_active: 0, updated_at: new Date().toISOString() }, 'id = ?', [id]);
  }

  // Options
  findOptions(modifierId: string, onlyActive: boolean = true): ModifierOption[] {
    const where = onlyActive ? 'modifier_id = ? AND is_active = 1' : 'modifier_id = ?';
    return qb.select('modifier_options', '*', where, [modifierId]) as ModifierOption[];
  }

  findOptionById(id: string): ModifierOption | undefined {
    return qb.selectOne('modifier_options', '*', 'id = ?', [id]) as ModifierOption | undefined;
  }

  createOption(data: Partial<ModifierOption>): ModifierOption {
    const id = data.id || uuid();
    const now = new Date().toISOString();
    qb.insert('modifier_options', {
      id,
      modifier_id: data.modifier_id!,
      name: data.name!,
      price_add: data.price_add || 0,
      sort_order: data.sort_order || 0,
      is_active: data.is_active !== undefined ? data.is_active : 1,
      created_at: now,
      updated_at: now,
    });
    return this.findOptionById(id)!;
  }

  updateOption(id: string, data: Partial<ModifierOption>): ModifierOption {
    qb.update('modifier_options', { ...data, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findOptionById(id)!;
  }

  deleteOption(id: string): void {
    qb.update('modifier_options', { is_active: 0, updated_at: new Date().toISOString() }, 'id = ?', [id]);
  }
}

export const modifiersModel = new ModifiersModel();
