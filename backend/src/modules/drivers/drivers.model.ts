import { qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import { DeliveryDriver } from '../../shared/types';

export class DriversModel {
  findAll(filters?: { is_active?: boolean }): DeliveryDriver[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.is_active ? 1 : 0);
    }

    const where = conditions.length > 0 ? conditions.join(' AND ') : undefined;
    return qb.select('delivery_drivers', '*', where, params) as DeliveryDriver[];
  }

  findById(id: string): DeliveryDriver | undefined {
    return qb.selectOne('delivery_drivers', '*', 'id = ?', [id]) as DeliveryDriver | undefined;
  }

  findByPhone(phone: string): DeliveryDriver | undefined {
    return qb.selectOne('delivery_drivers', '*', 'phone = ?', [phone]) as DeliveryDriver | undefined;
  }

  create(data: Partial<DeliveryDriver>): DeliveryDriver {
    const id = data.id || uuid();
    const now = new Date().toISOString();
    qb.insert('delivery_drivers', {
      id,
      name: data.name!,
      phone: data.phone!,
      vehicle: data.vehicle || null,
      plate: data.plate || null,
      is_active: data.is_active !== undefined ? data.is_active : 1,
      is_available: data.is_available !== undefined ? data.is_available : 1,
      total_deliveries: 0,
      created_at: now,
      updated_at: now,
    });
    return this.findById(id)!;
  }

  update(id: string, data: Partial<DeliveryDriver>): DeliveryDriver {
    qb.update('delivery_drivers', { ...data, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findById(id)!;
  }

  delete(id: string): void {
    qb.update('delivery_drivers', { is_active: 0, updated_at: new Date().toISOString() }, 'id = ?', [id]);
  }

  toggleAvailability(id: string): DeliveryDriver {
    const driver = this.findById(id);
    if (!driver) throw new Error('Motorista não encontrado');
    const newAvailability = driver.is_available ? 0 : 1;
    qb.update('delivery_drivers', { is_available: newAvailability, updated_at: new Date().toISOString() }, 'id = ?', [id]);
    return this.findById(id)!;
  }
}

export const driversModel = new DriversModel();
