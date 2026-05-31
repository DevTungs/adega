import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { query, queryOne } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

const clientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  gtin_username: z.string().optional().nullable(),
  gtin_password: z.string().optional().nullable(),
});

// List all clients
router.get('/', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const includeInactive = req.query.includeInactive === '1';
  const sql = includeInactive
    ? 'SELECT * FROM clients ORDER BY created_at DESC'
    : 'SELECT * FROM clients WHERE is_active = 1 ORDER BY created_at DESC';
  const clients = await query(sql);
  res.json({ success: true, data: clients });
}));

// Get client by ID
router.get('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const client = await queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
  if (!client) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Cliente não encontrado' });
  res.json({ success: true, data: client });
}));

// Create client
router.post('/', authMiddleware, validateBody(clientSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = uuid();
  const { name, email, phone, notes, gtin_username, gtin_password } = req.body;
  await query(
    'INSERT INTO clients (id, name, email, phone, notes, gtin_username, gtin_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, name, email || null, phone || null, notes || null, gtin_username || null, gtin_password || null]
  );
  const client = await queryOne('SELECT * FROM clients WHERE id = ?', [id]);
  res.status(201).json({ success: true, data: client });
}));

// Update client
router.put('/:id', authMiddleware, validateBody(clientSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, notes, gtin_username, gtin_password } = req.body;
  await query(
    'UPDATE clients SET name = ?, email = ?, phone = ?, notes = ?, gtin_username = ?, gtin_password = ?, updated_at = NOW() WHERE id = ?',
    [name, email || null, phone || null, notes || null, gtin_username || null, gtin_password || null, req.params.id]
  );
  const client = await queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
  if (!client) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Cliente não encontrado' });
  res.json({ success: true, data: client });
}));

// Deactivate client (soft delete)
router.patch('/:id/deactivate', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const client = await queryOne('SELECT * FROM clients WHERE id = ? AND is_active = 1', [req.params.id]);
  if (!client) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Cliente não encontrado' });
  await query('UPDATE licenses SET status = ?, updated_at = NOW() WHERE client_id = ? AND status = ?', ['blocked', req.params.id, 'active']);
  await query('UPDATE client_users SET is_active = 0, updated_at = NOW() WHERE client_id = ? AND is_active = 1', [req.params.id]);
  await query('UPDATE clients SET is_active = 0, updated_at = NOW() WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Cliente inativado' });
}));

// Reactivate client
router.patch('/:id/activate', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const client = await queryOne('SELECT * FROM clients WHERE id = ? AND is_active = 0', [req.params.id]);
  if (!client) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Cliente não encontrado ou já ativo' });
  await query('UPDATE clients SET is_active = 1, updated_at = NOW() WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Cliente reativado' });
}));

// Delete client (hard delete — removes from database permanently)
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const client = await queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id]);
  if (!client) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Cliente não encontrado' });
  const licenseIds = (await query('SELECT id FROM licenses WHERE client_id = ?', [req.params.id]) as { id: string }[]).map(l => l.id);
  if (licenseIds.length > 0) {
    const placeholders = licenseIds.map(() => '?').join(',');
    await query(`DELETE FROM license_machines WHERE license_id IN (${placeholders})`, licenseIds);
    await query(`DELETE FROM license_activations WHERE license_id IN (${placeholders})`, licenseIds);
  }
  await query('DELETE FROM licenses WHERE client_id = ?', [req.params.id]);
  await query('DELETE FROM client_users WHERE client_id = ?', [req.params.id]);
  await query('DELETE FROM clients WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Cliente excluído permanentemente' });
}));

export default router;
