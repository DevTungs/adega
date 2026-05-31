import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { authService } from './auth.service';
import { authMiddleware, getUser } from './auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';
import { qb, getDb } from '../../config/database';
import { AppError } from '../../shared/errors/app-error';

const setupSchema = z.object({
  username: z.string().min(3, 'Usuario deve ter pelo menos 3 caracteres'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  name: z.string().min(1, 'Informe o nome'),
});

const loginSchema = z.object({
  username: z.string().min(1, 'Informe o usuario'),
  password: z.string().min(1, 'Informe a senha'),
});

const createUserSchema = z.object({
  username: z.string().min(3, 'Usuario deve ter pelo menos 3 caracteres'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  name: z.string().optional(),
  role: z.string().optional().default('admin'),
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  role: z.string().optional(),
  is_active: z.number().optional(),
  password: z.string().min(6).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  // Setup status (public) — check if any user exists
  app.get('/api/setup/status', {
    handler: async (_request, reply) => {
      const count = qb.selectOne('users', 'COUNT(*) as count') as any;
      reply.send({ success: true, data: { needsSetup: (count?.count || 0) === 0 } });
    },
  });

  // Setup register (public) — create first admin user
  app.post('/api/setup/register', {
    handler: async (request, reply) => {
      // Only works if no users exist
      const count = qb.selectOne('users', 'COUNT(*) as count') as any;
      if ((count?.count || 0) > 0) {
        throw AppError.badRequest('Setup ja realizado');
      }

      const { username, password, name } = request.body as z.infer<typeof setupSchema>;

      const id = uuid();
      const now = new Date().toISOString();

      qb.insert('users', {
        id,
        username,
        password_hash: bcrypt.hashSync(password, 10),
        name,
        role: 'admin',
        is_active: 1,
        created_at: now,
        updated_at: now,
      });

      const token = app.jwt.sign({ id, username, name, role: 'admin' });

      reply.status(201).send({
        success: true,
        data: { token, user: { id, username, name, role: 'admin' } },
        message: 'Conta criada com sucesso',
      });
    },
  });

  // Login (public)
  app.post('/api/auth/login', {
    preHandler: [validateBody(loginSchema)],
    handler: async (request, reply) => {
      const { username, password } = request.body as z.infer<typeof loginSchema>;
      const user = await authService.login(username, password);

      const token = app.jwt.sign({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      });

      reply.send({
        success: true,
        data: { token, user },
        message: 'Login realizado com sucesso',
      });
    },
  });

  // Get profile (authenticated)
  app.get('/api/auth/me', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const u = getUser(request);
      const user = await authService.getProfile(u.id, u);
      reply.send({ success: true, data: user });
    },
  });

  // Change own password
  app.post('/api/auth/change-password', {
    preHandler: [authMiddleware, validateBody(changePasswordSchema)],
    handler: async (request, reply) => {
      const { currentPassword, newPassword } = request.body as z.infer<typeof changePasswordSchema>;
      const { password_hash } = qb.selectOne('users', 'password_hash', 'id = ? AND is_active = 1', [getUser(request).id]) as any;

      if (!password_hash || !bcrypt.compareSync(currentPassword, password_hash)) {
        throw AppError.unauthorized('Senha atual incorreta');
      }

      qb.update('users', {
        password_hash: bcrypt.hashSync(newPassword, 10),
        updated_at: new Date().toISOString(),
      }, 'id = ?', [getUser(request).id]);

      reply.send({ success: true, message: 'Senha alterada' });
    },
  });

  // =====================================================
  // USER MANAGEMENT (admin only)
  // =====================================================

  // List users
  app.get('/api/users', {
    preHandler: [authMiddleware],
    handler: async (_request, reply) => {
      const users = qb.select('users', 'id, username, name, role, is_active, created_at, updated_at');
      reply.send({ success: true, data: users });
    },
  });

  // Create user
  app.post('/api/users', {
    preHandler: [authMiddleware, validateBody(createUserSchema)],
    handler: async (request, reply) => {
      const { username, password, name, role } = request.body as z.infer<typeof createUserSchema>;

      const existing = qb.selectOne('users', 'id', 'username = ?', [username]);
      if (existing) {
        throw AppError.badRequest('Usuario ja existe');
      }

      const id = uuid();
      const now = new Date().toISOString();

      qb.insert('users', {
        id,
        username,
        password_hash: bcrypt.hashSync(password, 10),
        name: name || username,
        role,
        is_active: 1,
        created_at: now,
        updated_at: now,
      });

      const user = qb.selectOne('users', 'id, username, name, role, is_active, created_at', 'id = ?', [id]);
      reply.status(201).send({ success: true, data: user, message: 'Usuario criado' });
    },
  });

  // Update user
  app.put('/api/users/:id', {
    preHandler: [authMiddleware, validateBody(updateUserSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof updateUserSchema>;

      const existing = qb.selectOne('users', 'id', 'id = ?', [id]);
      if (!existing) {
        throw AppError.notFound('Usuario nao encontrado');
      }

      const updates: any = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.role !== undefined) updates.role = body.role;
      if (body.is_active !== undefined) updates.is_active = body.is_active;
      if (body.password) updates.password_hash = bcrypt.hashSync(body.password, 10);

      qb.update('users', updates, 'id = ?', [id]);

      const user = qb.selectOne('users', 'id, username, name, role, is_active, created_at, updated_at', 'id = ?', [id]);
      reply.send({ success: true, data: user, message: 'Usuario atualizado' });
    },
  });

  // Delete user (soft delete)
  app.delete('/api/users/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = qb.selectOne('users', 'id', 'id = ?', [id]);
      if (!existing) {
        throw AppError.notFound('Usuario nao encontrado');
      }

      // Don't allow deleting yourself
      if (id === getUser(request).id) {
        throw AppError.badRequest('Nao e possivel excluir seu proprio usuario');
      }

      qb.update('users', { is_active: 0, updated_at: new Date().toISOString() }, 'id = ?', [id]);
      reply.send({ success: true, message: 'Usuario removido' });
    },
  });
}
