import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { promotionsService } from './promotions.service';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const promotionSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().nullable().optional(),
  type: z.enum(['percentage', 'fixed', 'buy_x_get_y']),
  value: z.number().nullable().optional(),
  min_order_value: z.number().nullable().optional(),
  min_quantity: z.number().int().nullable().optional(),
  applicable_products: z.string().nullable().optional(),
  applicable_categories: z.string().nullable().optional(),
  buy_quantity: z.number().int().nullable().optional(),
  get_quantity: z.number().int().nullable().optional(),
  start_date: z.string().min(1, 'Data início é obrigatória'),
  end_date: z.string().min(1, 'Data fim é obrigatória'),
  is_active: z.number().int().optional(),
  max_uses: z.number().int().nullable().optional(),
});

export async function registerPromotionRoutes(app: FastifyInstance) {
  app.get('/api/promotions', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const promotions = await promotionsService.getAll();
      reply.send({ success: true, data: promotions });
    },
  });

  app.get('/api/promotions/active', {
    handler: async (request, reply) => {
      const promotions = await promotionsService.getActive();
      reply.send({ success: true, data: promotions });
    },
  });

  app.get('/api/promotions/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const promotion = await promotionsService.getById(id);
      reply.send({ success: true, data: promotion });
    },
  });

  app.post('/api/promotions', {
    preHandler: [authMiddleware, validateBody(promotionSchema)],
    handler: async (request, reply) => {
      const promotion = await promotionsService.create(request.body as any);
      reply.status(201).send({ success: true, data: promotion });
    },
  });

  app.put('/api/promotions/:id', {
    preHandler: [authMiddleware, validateBody(promotionSchema.partial())],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const promotion = await promotionsService.update(id, request.body as any);
      reply.send({ success: true, data: promotion });
    },
  });

  app.delete('/api/promotions/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await promotionsService.delete(id);
      reply.send({ success: true, message: 'Promoção removida' });
    },
  });
}
