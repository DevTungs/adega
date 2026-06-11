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

  getPixKey(): string {
    return this.getFromDb('pix_key') || '';
  }

  getPaymentMethods(): Array<{ id: string; label: string; icon: string; enabled: boolean; order: number }> {
    try {
      const raw = this.getFromDb('payment_methods');
      if (!raw) return [];
      const methods = JSON.parse(raw);
      return methods.filter((m: any) => m.enabled !== false).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    } catch {
      return [];
    }
  }

  getDeliveryFeeRanges(): Array<{ from: string; to: string; fee: number }> {
    try {
      const raw = this.getFromDb('delivery_fee_ranges');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  getDeliveryPricing(orderType: string, subtotal: number): { deliveryFee: number; minOrder: number; meetsMinimum: boolean; shortfall: number } {
    const deliveryFee = orderType === 'delivery' ? this.calculateTimeBasedDeliveryFee() : 0;
    const minOrder = this.getMinOrder();
    const shortfall = minOrder > 0 && subtotal < minOrder ? minOrder - subtotal : 0;
    const meetsMinimum = minOrder <= 0 || subtotal >= minOrder;

    return { deliveryFee, minOrder, meetsMinimum, shortfall };
  }

  calculateTimeBasedDeliveryFee(): number {
    const ranges = this.getDeliveryFeeRanges();
    if (ranges.length === 0) {
      return this.getDeliveryFee();
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const range of ranges) {
      const [fromH, fromM] = range.from.split(':').map(Number);
      const [toH, toM] = range.to.split(':').map(Number);
      const fromMinutes = fromH * 60 + fromM;
      const toMinutes = toH * 60 + toM;

      if (currentMinutes >= fromMinutes && currentMinutes <= toMinutes) {
        return range.fee;
      }
    }

    return this.getDeliveryFee();
  }
}

export const settingsAgent = new SettingsAgent();
