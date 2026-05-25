import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { query, queryOne } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const clientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// List all clients
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const clients = await query('SELECT * FROM clients WHERE is_active = 1 ORDER BY created_at DESC');
  res.json({ success: true, data: clients });
});

// Get client by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const client = await queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
  if (!client) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Cliente não encontrado' });
  res.json({ success: true, data: client });
});

// Create client
router.post('/', authMiddleware, validateBody(clientSchema), async (req: Request, res: Response) => {
  const id = uuid();
  const { name, email, phone, notes } = req.body;
  await query(
    'INSERT INTO clients (id, name, email, phone, notes) VALUES (?, ?, ?, ?, ?)',
    [id, name, email || null, phone || null, notes || null]
  );
  const client = await queryOne('SELECT * FROM clients WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: client });
});

// Update client
router.put('/:id', authMiddleware, validateBody(clientSchema), async (req: Request, res: Response) => {
  const { name, email, phone, notes } = req.body;
  await query(
    'UPDATE clients SET name = ?, email = ?, phone = ?, notes = ?, updated_at = NOW() WHERE id = ?',
    [name, email || null, phone || null, notes || null, req.params.id]
  );
  const client = await queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
  if (!client) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Cliente não encontrado' });
  res.json({ success: true, data: client });
});

// Delete client (soft delete — blocks active licenses first)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const client = await queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
  if (!client) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Cliente não encontrado' });
  await query('UPDATE licenses SET status = ?, updated_at = NOW() WHERE client_id = ? AND status = ?', ['blocked', req.params.id, 'active']);
  await query('UPDATE clients SET is_active = 0, updated_at = NOW() WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Cliente removido' });
});

export default router;
