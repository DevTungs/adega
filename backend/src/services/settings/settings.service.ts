import { getDb } from '../../config/database';

export class SettingsAgent {
  private cache: Map<string, { value: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5000;

  private getFromDb(key: string): string | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.value;
    }

    try {
      const db = getDb();
      const row = db.get('SELECT value FROM settings WHERE key = ?', [key]);
      const value = row?.value ?? null;
      if (value !== null) {
        this.cache.set(key, { value, timestamp: Date.now() });
      }
      return value;
    } catch {
      return null;
    }
  }

  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  getDeliveryFee(): number {
    const raw = this.getFromDb('delivery_fee');
    return raw ? parseFloat(raw) || 0 : 0;
  }

  getMinOrder(): number {
    const raw = this.getFromDb('min_order');
    return raw ? parseFloat(raw) || 0 : 0;
  }

  getDeliveryRadius(): number {
    const raw = this.getFromDb('delivery_radius');
    return raw ? parseInt(raw) || 0 : 0;
  }

  getDeliveryPricing(orderType: string, subtotal: number): { deliveryFee: number; minOrder: number; meetsMinimum: boolean; shortfall: number } {
    const deliveryFee = orderType === 'delivery' ? this.getDeliveryFee() : 0;
    const minOrder = this.getMinOrder();
    const shortfall = minOrder > 0 && subtotal < minOrder ? minOrder - subtotal : 0;
    const meetsMinimum = minOrder <= 0 || subtotal >= minOrder;

    return { deliveryFee, minOrder, meetsMinimum, shortfall };
  }
}

export const settingsAgent = new SettingsAgent();
