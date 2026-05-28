import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { driversService } from './drivers.service';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const driverSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  vehicle: z.string().nullable().optional(),
  plate: z.string().nullable().optional(),
  is_active: z.number().int().optional(),
  is_available: z.number().int().optional(),
});

export async function registerDriverRoutes(app: FastifyInstance) {
  app.get('/api/drivers', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const drivers = await driversService.getAll();
      reply.send({ success: true, data: drivers });
    },
  });

  app.get('/api/drivers/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const driver = await driversService.getById(id);
      reply.send({ success: true, data: driver });
    },
  });

  app.post('/api/drivers', {
    preHandler: [authMiddleware, validateBody(driverSchema)],
    handler: async (request, reply) => {
      const driver = await driversService.create(request.body as any);
      reply.status(201).send({ success: true, data: driver });
    },
  });

  app.put('/api/drivers/:id', {
    preHandler: [authMiddleware, validateBody(driverSchema.partial())],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const driver = await driversService.update(id, request.body as any);
      reply.send({ success: true, data: driver });
    },
  });

  app.delete('/api/drivers/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await driversService.delete(id);
      reply.send({ success: true, message: 'Motorista removido' });
    },
  });

  app.patch('/api/drivers/:id/availability', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const driver = await driversService.toggleAvailability(id);
      reply.send({ success: true, data: driver });
    },
  });
}
