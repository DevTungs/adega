export class CacheService {
  private memoryCache = new Map<string, { data: any; expires: number }>();

  get<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (entry.expires < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set(key: string, data: any, ttlSeconds: number = 300): void {
    this.memoryCache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.memoryCache.delete(key);
  }

  clear(): void {
    this.memoryCache.clear();
  }

  // Catalog specific
  getCatalog() {
    return this.get<any[]>('catalog');
  }

  setCatalog(catalog: any[]) {
    this.set('catalog', catalog, 300); // 5 min
  }

  invalidateCatalog() {
    this.delete('catalog');
  }

}

export const cacheService = new CacheService();
