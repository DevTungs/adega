import { Router, Response } from 'express';
import { query, queryOne } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const [clients, licenses, recentActivations] = await Promise.all([
    queryOne(
      `SELECT
        COUNT(*) as total,
        SUM(is_active = 1) as active
       FROM clients`
    ),
    queryOne(
      `SELECT
        COUNT(*) as total,
        SUM(status = 'active') as active,
        SUM(status = 'expired') as expired,
        SUM(status = 'blocked') as blocked,
        SUM(status = 'pending') as pending
       FROM licenses`
    ),
    query(
      `SELECT la.*, l.license_key, c.name as client_name
       FROM license_activations la
       LEFT JOIN licenses l ON l.id = la.license_id
       LEFT JOIN clients c ON c.id = l.client_id
       ORDER BY la.created_at DESC
       LIMIT 10`
    ),
  ]);

  res.json({
    success: true,
    data: {
      totalClients: Number(clients?.total || 0),
      activeClients: Number(clients?.active || 0),
      totalLicenses: Number(licenses?.total || 0),
      activeLicenses: Number(licenses?.active || 0),
      expiredLicenses: Number(licenses?.expired || 0),
      blockedLicenses: Number(licenses?.blocked || 0),
      pendingLicenses: Number(licenses?.pending || 0),
      recentActivations: recentActivations || [],
    },
  });
});

export default router;
