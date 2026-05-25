import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, queryOne } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const clientUserSchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  username: z.string().min(1, 'Username é obrigatório'),
  password: z.string().min(4, 'Senha deve ter no minimo 4 caracteres').optional(),
  name: z.string().optional().nullable(),
  role: z.string().optional(),
});

// List all client users
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const users = await query(
    `SELECT cu.id, cu.client_id, cu.username, cu.name, cu.role, cu.is_active, cu.created_at, cu.updated_at,
            c.name as client_name
     FROM client_users cu
     LEFT JOIN clients c ON c.id = cu.client_id
     ORDER BY cu.created_at DESC`
  );
  res.json({ success: true, data: users });
});

// Get client user by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await queryOne(
    `SELECT cu.id, cu.client_id, cu.username, cu.name, cu.role, cu.is_active, cu.created_at, cu.updated_at,
            c.name as client_name
     FROM client_users cu
     LEFT JOIN clients c ON c.id = cu.client_id
     WHERE cu.id = ?`,
    [req.params.id]
  );
  if (!user) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Usuario nao encontrado' });
  res.json({ success: true, data: user });
});

// Create client user
router.post('/', authMiddleware, validateBody(clientUserSchema), async (req: Request, res: Response) => {
  const { client_id, username, password, name, role } = req.body;

  if (!password) {
    return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Senha é obrigatória' });
  }

  // Check username uniqueness
  const existing = await queryOne('SELECT id FROM client_users WHERE username = ?', [username]);
  if (existing) {
    return res.status(409).json({ success: false, error: 'CONFLICT', message: 'Username já existe' });
  }

  // If client_id provided, check client exists
  if (client_id) {
    const client = await queryOne('SELECT id FROM clients WHERE id = ?', [client_id]);
    if (!client) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Cliente não encontrado' });
    }
  }

  const id = uuid();
  const password_hash = bcrypt.hashSync(password, 10);
  await query(
    'INSERT INTO client_users (id, client_id, username, password_hash, name, role) VALUES (?, ?, ?, ?, ?, ?)',
    [id, client_id || null, username, password_hash, name || null, role || 'admin']
  );

  const user = await queryOne(
    `SELECT cu.id, cu.client_id, cu.username, cu.name, cu.role, cu.is_active, cu.created_at, cu.updated_at,
            c.name as client_name
     FROM client_users cu
     LEFT JOIN clients c ON c.id = cu.client_id
     WHERE cu.id = ?`,
    [id]
  );
  res.status(201).json({ success: true, data: user });
});

// Update client user
router.put('/:id', authMiddleware, validateBody(clientUserSchema), async (req: Request, res: Response) => {
  const { client_id, username, password, name, role } = req.body;
  const { id } = req.params;

  const existing = await queryOne('SELECT * FROM client_users WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Usuario nao encontrado' });
  }

  // Check username uniqueness (excluding self)
  const dup = await queryOne('SELECT id FROM client_users WHERE username = ? AND id != ?', [username, id]);
  if (dup) {
    return res.status(409).json({ success: false, error: 'CONFLICT', message: 'Username já existe' });
  }

  let password_hash = existing.password_hash;
  if (password) {
    password_hash = bcrypt.hashSync(password, 10);
  }

  await query(
    'UPDATE client_users SET client_id = ?, username = ?, password_hash = ?, name = ?, role = ?, updated_at = NOW() WHERE id = ?',
    [client_id || null, username, password_hash, name || null, role || 'admin', id]
  );

  const user = await queryOne(
    `SELECT cu.id, cu.client_id, cu.username, cu.name, cu.role, cu.is_active, cu.created_at, cu.updated_at,
            c.name as client_name
     FROM client_users cu
     LEFT JOIN clients c ON c.id = cu.client_id
     WHERE cu.id = ?`,
    [id]
  );
  res.json({ success: true, data: user });
});

// Delete client user (soft delete)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await queryOne('SELECT * FROM client_users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Usuario nao encontrado' });
  await query('UPDATE client_users SET is_active = 0, updated_at = NOW() WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Usuario removido' });
});

export default router;
