import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productsService } from './products.service';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().optional(),
  category_id: z.string().min(1, 'Categoria é obrigatória'),
  description: z.string().nullable().optional(),
  price: z.number().positive('Preço deve ser positivo'),
  promo_price: z.number().positive().nullable().optional(),
  cost_price: z.number().positive().nullable().optional(),
  image_url: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  stock: z.number().int().optional(),
  min_stock: z.number().int().optional(),
  unit: z.string().optional(),
  volume: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  is_featured: z.number().int().optional(),
  display_order: z.number().int().optional(),
});

const stockSchema = z.object({
  quantity: z.number().int(),
});

export async function registerProductRoutes(app: FastifyInstance) {
  // List all
  app.get('/api/products', {
    handler: async (request, reply) => {
      const { category_id, search } = request.query as any;
      const products = await productsService.getAll({ category_id, search, is_active: true });
      reply.send({ success: true, data: products });
    },
  });

  // Get catalog (grouped by category)
  app.get('/api/products/catalog', {
    handler: async (request, reply) => {
      const catalog = await productsService.getCatalog();
      reply.send({ success: true, data: catalog });
    },
  });

  // Get by ID
  app.get('/api/products/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const product = await productsService.getById(id);
      reply.send({ success: true, data: product });
    },
  });

  // Create
  app.post('/api/products', {
    preHandler: [authMiddleware, validateBody(productSchema)],
    handler: async (request, reply) => {
      const product = await productsService.create(request.body as any);
      reply.status(201).send({ success: true, data: product });
    },
  });

  // Update
  app.put('/api/products/:id', {
    preHandler: [authMiddleware, validateBody(productSchema.partial())],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const product = await productsService.update(id, request.body as any);
      reply.send({ success: true, data: product });
    },
  });

  // Delete (soft)
  app.delete('/api/products/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await productsService.delete(id);
      reply.send({ success: true, message: 'Produto removido' });
    },
  });

  // Update stock
  app.patch('/api/products/:id/stock', {
    preHandler: [authMiddleware, validateBody(stockSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { quantity } = request.body as z.infer<typeof stockSchema>;
      await productsService.updateStock(id, quantity);
      reply.send({ success: true, message: 'Estoque atualizado' });
    },
  });
}
