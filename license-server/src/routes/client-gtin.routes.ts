import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { queryOne } from '../config/database';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

// Token cache per client
const tokenCache = new Map<string, { token: string; expires_at: number }>();

const tokenSchema = z.object({
  licenseKey: z.string().min(1, 'Chave de licença é obrigatória'),
  machineFingerprint: z.string().min(1, 'Fingerprint da máquina é obrigatório'),
});

// Issue GTIN API token for a client
router.post('/token', validateBody(tokenSchema), asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey, machineFingerprint } = req.body;

  // Find license + client GTIN credentials
  const license = await queryOne(
    `SELECT l.client_id, c.gtin_username, c.gtin_password, c.is_active as client_active
     FROM licenses l
     JOIN clients c ON c.id = l.client_id
     WHERE l.license_key = ?`,
    [licenseKey]
  ) as any;

  if (!license) {
    return res.status(404).json({ success: false, message: 'Licença não encontrada' });
  }

  if (!license.client_active) {
    return res.status(403).json({ success: false, message: 'Cliente inativo' });
  }

  if (!license.gtin_username || !license.gtin_password) {
    return res.status(400).json({ success: false, message: 'Credenciais GTIN não configuradas para este cliente' });
  }

  // Check cache
  const cacheKey = license.client_id;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expires_at > Date.now()) {
    return res.json({ success: true, data: { token: cached.token } });
  }

  // Request new token from GTIN API
  const credentials = Buffer.from(`${license.gtin_username}:${license.gtin_password}`).toString('base64');

  try {
    const response = await fetch('https://gtin.rscsistemas.com.br/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return res.status(502).json({
        success: false,
        message: `Erro ao obter token GTIN: ${response.status}`,
        detail: errorText,
      });
    }

    const data = await response.json() as { token: string };

    // Cache for 55 minutes (token expires in 1 hour)
    tokenCache.set(cacheKey, {
      token: data.token,
      expires_at: Date.now() + 55 * 60 * 1000,
    });

    return res.json({ success: true, data: { token: data.token } });
  } catch (error: any) {
    return res.status(502).json({
      success: false,
      message: 'Erro ao conectar com a API GTIN',
      detail: error.message,
    });
  }
}));

export default router;
