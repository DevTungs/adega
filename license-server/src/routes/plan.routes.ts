import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { query, queryOne } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

const planSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional().nullable(),
  duration_days: z.number().int().positive().default(30),
  grace_days: z.number().int().min(0).default(3),
  price: z.number().min(0).default(0),
  max_machines: z.number().int().positive().default(1),
});

// List all plans
router.get('/', authMiddleware, asyncHandler(async (_req: AuthRequest, res: Response) => {
  const plans = await query('SELECT * FROM plans ORDER BY price ASC');
  res.json({ success: true, data: plans });
}));

// Create plan
router.post('/', authMiddleware, validateBody(planSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = uuid();
  const { name, description, duration_days, grace_days, price, max_machines } = req.body;
  await query(
    'INSERT INTO plans (id, name, description, duration_days, grace_days, price, max_machines) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, description || null, duration_days, grace_days ?? 3, price, max_machines ?? 1]
  );
  const plan = await queryOne('SELECT * FROM plans WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: plan });
}));

// Update plan
router.put('/:id', authMiddleware, validateBody(planSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, description, duration_days, grace_days, price, max_machines } = req.body;
  await query(
    'UPDATE plans SET name = ?, description = ?, duration_days = ?, grace_days = ?, price = ?, max_machines = ?, updated_at = NOW() WHERE id = ?',
    [name, description || null, duration_days, grace_days ?? 3, price, max_machines ?? 1, req.params.id]
  );
  const plan = await queryOne('SELECT * FROM plans WHERE id = ?', [req.params.id]);
  if (!plan) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Plano não encontrado' });
  res.json({ success: true, data: plan });
}));

// Delete plan (hard delete — cascades to licenses, machines, activations)
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const plan = await queryOne('SELECT * FROM plans WHERE id = ?', [req.params.id]);
  if (!plan) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Plano não encontrado' });

  // Get all license IDs for this plan
  const licenseIds = (await query('SELECT id FROM licenses WHERE plan_id = ?', [req.params.id]) as { id: string }[]).map(l => l.id);
  if (licenseIds.length > 0) {
    const placeholders = licenseIds.map(() => '?').join(',');
    await query(`DELETE FROM license_machines WHERE license_id IN (${placeholders})`, licenseIds);
    await query(`DELETE FROM license_activations WHERE license_id IN (${placeholders})`, licenseIds);
    await query(`DELETE FROM licenses WHERE plan_id = ?`, [req.params.id]);
  }
  await query('DELETE FROM plans WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Plano excluído permanentemente' });
}));

export default router;
