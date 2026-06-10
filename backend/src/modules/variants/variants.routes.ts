import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { variantsService } from './variants.service';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const variantSchema = z.object({
  product_id: z.string().min(1),
  name: z.string().min(1, 'Nome da variação é obrigatório'),
  description: z.string().nullable().optional(),
  price: z.number().positive('Preço deve ser positivo'),
  promo_price: z.number().positive().nullable().optional(),
  stock: z.number().nullable().optional(),
  barcode: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.number().int().optional(),
});

export async function registerVariantRoutes(app: FastifyInstance) {
  // List variants for a product
  app.get('/api/products/:productId/variants', {
    handler: async (request, reply) => {
      const { productId } = request.params as { productId: string };
      const variants = await variantsService.getByProduct(productId);
      reply.send({ success: true, data: variants });
    },
  });

  // Get single variant
  app.get('/api/variants/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const variant = await variantsService.getById(id);
      reply.send({ success: true, data: variant });
    },
  });

  // Create
  app.post('/api/variants', {
    preHandler: [authMiddleware, validateBody(variantSchema)],
    handler: async (request, reply) => {
      const variant = await variantsService.create(request.body as any);
      reply.status(201).send({ success: true, data: variant });
    },
  });

  // Update
  app.put('/api/variants/:id', {
    preHandler: [authMiddleware, validateBody(variantSchema.partial())],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const variant = await variantsService.update(id, request.body as any);
      reply.send({ success: true, data: variant });
    },
  });

  // Delete (soft)
  app.delete('/api/variants/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await variantsService.delete(id);
      reply.send({ success: true, message: 'Variação removida' });
    },
  });

  // Update stock
  app.patch('/api/variants/:id/stock', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { quantity } = request.body as { quantity: number };
      await variantsService.updateStock(id, quantity);
      reply.send({ success: true, message: 'Estoque atualizado' });
    },
  });
}
