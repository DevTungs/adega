import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authService } from './auth.service';
import { authMiddleware, getUser } from './auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const loginSchema = z.object({
  username: z.string().min(1, 'Username é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export async function registerAuthRoutes(app: FastifyInstance) {
  // Login
  app.post('/api/auth/login', {
    preHandler: [validateBody(loginSchema)],
    handler: async (request, reply) => {
      const { username, password } = request.body as z.infer<typeof loginSchema>;
      const user = await authService.login(username, password);
      const token = app.jwt.sign({
        id: user.id,
        username: user.username,
        role: user.role,
      });

      reply.send({
        success: true,
        data: { user, token },
      });
    },
  });

  // Get profile
  app.get('/api/auth/me', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const user = getUser(request);
      const profile = await authService.getProfile(user.id);
      reply.send({ success: true, data: profile });
    },
  });

  // Logout (client-side token removal, but we can log it)
  app.post('/api/auth/logout', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      reply.send({ success: true, message: 'Logout realizado' });
    },
  });
}
