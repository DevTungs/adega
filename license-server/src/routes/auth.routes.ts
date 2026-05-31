import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { queryOne } from '../config/database';
import { validateBody } from '../middleware/validate';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

router.post('/login', validateBody(loginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const admin = await queryOne('SELECT * FROM admins WHERE username = ? AND is_active = 1', [username]);

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    data: {
      token,
      admin: { id: admin.id, username: admin.username, name: admin.name },
    },
  });
}));

router.get('/me', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const admin = await queryOne('SELECT id, username, name, created_at FROM admins WHERE id = ?', [req.admin!.id]);
  if (!admin) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Admin não encontrado' });
  res.json({ success: true, data: admin });
}));

export default router;
