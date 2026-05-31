import axios from 'axios';
import { qb } from '../../config/database';
import { licenseModel } from '../license/license.model';
import { logger } from '../../shared/middlewares/logger';

interface BarcodeProduct {
  found: boolean;
  product_name?: string;
  brands?: string;
  quantity?: string;
  image_url?: string;
  description?: string;
  error?: string;
}

interface BarcodeCacheEntry {
  barcode: string;
  product_name: string;
  brand: string;
  category: string;
  volume: string;
  image_url: string;
  description: string;
  fetched_at: string;
}

// ==============================
// CACHE LOCAL (SQLite)
// ==============================

function getCached(barcode: string): BarcodeProduct | null {
  const row = qb.selectOne('barcode_cache', '*', 'barcode = ?', [barcode]) as BarcodeCacheEntry | undefined;
  if (!row) return null;

  return {
    found: true,
    product_name: row.product_name || undefined,
    brands: row.brand || undefined,
    quantity: row.volume || undefined,
    image_url: row.image_url || undefined,
    description: row.description || undefined,
  };
}

function saveCache(barcode: string, product: BarcodeProduct) {
  const existing = qb.selectOne('barcode_cache', 'barcode', 'barcode = ?', [barcode]);
  const now = new Date().toISOString();

  const data = {
    barcode,
    product_name: product.product_name || '',
    brand: product.brands || '',
    category: product.description || '',
    volume: product.quantity || '',
    image_url: product.image_url || '',
    description: product.description || '',
    fetched_at: now,
  };

  if (existing) {
    qb.update('barcode_cache', data, 'barcode = ?', [barcode]);
  } else {
    qb.insert('barcode_cache', data);
  }
}

// ==============================
// TOKEN GTIN VIA LICENSE-SERVER
// ==============================

async function getGtinToken(): Promise<string | null> {
  // Check cached token
  const cached = licenseModel.getGtinToken();
  if (cached && new Date(cached.expires).getTime() > Date.now()) {
    return cached.token;
  }

  // Request new token from license-server
  const licenseKey = licenseModel.getCurrent()?.license_key;
  if (!licenseKey) {
    logger.warn('No license key available for GTIN token request');
    return null;
  }

  const baseUrl = process.env.LICENSE_API_URL;
  if (!baseUrl) {
    logger.warn('LICENSE_API_URL not configured');
    return null;
  }

  try {
    const { getMachineFingerprint } = await import('../license/machine-fingerprint');
    const fingerprint = getMachineFingerprint();

    const { data } = await axios.post(
      `${baseUrl.replace(/\/$/, '')}/api/client/gtin/token`,
      { licenseKey, machineFingerprint: fingerprint },
      { timeout: 15000 }
    );

    if (data.success && data.data?.token) {
      // Cache for 55 minutes
      const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();
      licenseModel.updateGtinToken(data.data.token, expiresAt);
      return data.data.token;
    }

    logger.warn({ response: data }, 'GTIN token request returned unexpected response');
    return null;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      logger.error({ status, message }, 'Failed to get GTIN token from license-server');
    } else {
      logger.error({ error: error.message }, 'Failed to get GTIN token');
    }
    return null;
  }
}

// ==============================
// CONSULTA API GTIN
// ==============================

async function lookupGtinApi(barcode: string, token: string): Promise<BarcodeProduct> {
  try {
    const response = await axios.get(
      `https://gtin.rscsistemas.com.br/api/gtin/infor/${encodeURIComponent(barcode)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.status === 200 && response.data?.nome) {
      return {
        found: true,
        product_name: response.data.nome || undefined,
        brands: response.data.marca || undefined,
        image_url: response.data.link_foto || undefined,
        description: response.data.categoria || undefined,
      };
    }

    return { found: false };
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 404) {
        return { found: false };
      }

      if (status === 401 || status === 403) {
        // Token invalid — clear it so next attempt fetches a new one
        licenseModel.updateGtinToken('', '');
        logger.warn({ barcode }, 'GTIN token expired or invalid, cleared cache');
        return { found: false };
      }

      if (status === 429) {
        logger.warn({ barcode }, 'GTIN API rate limit exceeded');
        return { found: false };
      }

      logger.error({ status, barcode }, 'GTIN API error');
      return { found: false };
    }

    logger.error({ error: error.message, barcode }, 'GTIN API request failed');
    return { found: false };
  }
}

// ==============================
// EXPORT: LOOKUP PRINCIPAL
// ==============================

export async function lookupBarcode(barcode: string): Promise<BarcodeProduct> {
  try {
    // 1. Check local cache first
    let cached: BarcodeProduct | null = null;
    try {
      cached = getCached(barcode);
    } catch {
      // Cache read failed, continue to API
    }
    if (cached) {
      logger.info({ barcode }, 'Barcode found in cache');
      return cached;
    }

    // 2. Get GTIN token (cached or from license-server)
    let licenseKey: string | undefined;
    try {
      licenseKey = licenseModel.getCurrent()?.license_key;
    } catch {
      return { found: false, error: 'Erro ao acessar dados da licenca.' };
    }
    if (!licenseKey) {
      return { found: false, error: 'Nenhuma licenca ativa. Ative a licenca para consultar codigos de barras.' };
    }

    const baseUrl = process.env.LICENSE_API_URL;
    if (!baseUrl) {
      return { found: false, error: 'Servidor de licencas nao configurado (LICENSE_API_URL).' };
    }

    const token = await getGtinToken();
    if (!token) {
      return { found: false, error: 'Credenciais da API GTIN nao configuradas. Configure o usuario e senha GTIN no painel de licencas (Clientes > Editar > API GTIN).' };
    }

    // 3. Query GTIN API
    const result = await lookupGtinApi(barcode, token);

    // 4. Save to cache if found
    if (result.found) {
      try {
        saveCache(barcode, result);
      } catch {
        // Cache save failed, not critical
      }
      logger.info({ barcode, name: result.product_name }, 'Barcode looked up from API and cached');
    }

    return result;
  } catch (error: any) {
    logger.error({ error: error.message, barcode }, 'Unexpected error in barcode lookup');
    return { found: false, error: 'Erro inesperado ao consultar codigo de barras.' };
  }
}
