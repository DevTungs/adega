import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { query, queryOne } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const planSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional().nullable(),
  duration_days: z.number().int().positive().default(30),
  grace_days: z.number().int().min(0).default(3),
  price: z.number().min(0).default(0),
});

// List all plans
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const plans = await query('SELECT * FROM plans ORDER BY price ASC');
  res.json({ success: true, data: plans });
});

// Create plan
router.post('/', authMiddleware, validateBody(planSchema), async (req: Request, res: Response) => {
  const id = uuid();
  const { name, description, duration_days, grace_days, price } = req.body;
  await query(
    'INSERT INTO plans (id, name, description, duration_days, grace_days, price) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, description || null, duration_days, grace_days ?? 3, price]
  );
  const plan = await queryOne('SELECT * FROM plans WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: plan });
});

// Update plan
router.put('/:id', authMiddleware, validateBody(planSchema), async (req: Request, res: Response) => {
  const { name, description, duration_days, grace_days, price } = req.body;
  await query(
    'UPDATE plans SET name = ?, description = ?, duration_days = ?, grace_days = ?, price = ?, updated_at = NOW() WHERE id = ?',
    [name, description || null, duration_days, grace_days ?? 3, price, req.params.id]
  );
  const plan = await queryOne('SELECT * FROM plans WHERE id = ?', [req.params.id]);
  if (!plan) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Plano não encontrado' });
  res.json({ success: true, data: plan });
});

// Delete plan (soft delete)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const inUse = await queryOne('SELECT id FROM licenses WHERE plan_id = ?', [req.params.id]);
  if (inUse) {
    return res.status(409).json({ success: false, error: 'CONFLICT', message: 'Plano em uso por licenças' });
  }
  await query('UPDATE plans SET is_active = 0, updated_at = NOW() WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Plano removido' });
});

export default router;
