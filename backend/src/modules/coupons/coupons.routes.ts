import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { couponsService } from './coupons.service';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const couponSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  description: z.string().nullable().optional(),
  type: z.enum(['percentage', 'fixed', 'free_delivery']),
  value: z.number().positive('Valor deve ser positivo'),
  min_order_value: z.number().nullable().optional(),
  max_discount: z.number().nullable().optional(),
  max_uses: z.number().int().nullable().optional(),
  per_customer: z.number().int().optional(),
  start_date: z.string().min(1, 'Data início é obrigatória'),
  end_date: z.string().min(1, 'Data fim é obrigatória'),
  is_active: z.number().int().optional(),
});

const validateCouponSchema = z.object({
  code: z.string().min(1),
  order_total: z.number().positive(),
  customer_id: z.string().optional(),
});

export async function registerCouponRoutes(app: FastifyInstance) {
  app.get('/api/coupons', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const coupons = await couponsService.getAll();
      reply.send({ success: true, data: coupons });
    },
  });

  app.get('/api/coupons/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const coupon = await couponsService.getById(id);
      reply.send({ success: true, data: coupon });
    },
  });

  app.post('/api/coupons', {
    preHandler: [authMiddleware, validateBody(couponSchema)],
    handler: async (request, reply) => {
      const coupon = await couponsService.create(request.body as any);
      reply.status(201).send({ success: true, data: coupon });
    },
  });

  app.put('/api/coupons/:id', {
    preHandler: [authMiddleware, validateBody(couponSchema.partial())],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const coupon = await couponsService.update(id, request.body as any);
      reply.send({ success: true, data: coupon });
    },
  });

  app.delete('/api/coupons/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await couponsService.delete(id);
      reply.send({ success: true, message: 'Cupom removido' });
    },
  });

  app.post('/api/coupons/validate', {
    preHandler: [authMiddleware, validateBody(validateCouponSchema)],
    handler: async (request, reply) => {
      const { code, order_total, customer_id } = request.body as z.infer<typeof validateCouponSchema>;
      const result = await couponsService.validate(code, order_total, customer_id);
      reply.send({ success: true, data: result });
    },
  });
}
