import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { categoriesService } from './categories.service';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const categorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  display_order: z.number().optional(),
});

export async function registerCategoryRoutes(app: FastifyInstance) {
  // List all
  app.get('/api/categories', {
    handler: async (request, reply) => {
      const categories = await categoriesService.getAll();
      reply.send({ success: true, data: categories });
    },
  });

  // Get by ID
  app.get('/api/categories/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const category = await categoriesService.getById(id);
      reply.send({ success: true, data: category });
    },
  });

  // Create
  app.post('/api/categories', {
    preHandler: [authMiddleware, validateBody(categorySchema)],
    handler: async (request, reply) => {
      const category = await categoriesService.create(request.body as any);
      reply.status(201).send({ success: true, data: category });
    },
  });

  // Update
  app.put('/api/categories/:id', {
    preHandler: [authMiddleware, validateBody(categorySchema.partial())],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const category = await categoriesService.update(id, request.body as any);
      reply.send({ success: true, data: category });
    },
  });

  // Delete (soft)
  app.delete('/api/categories/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await categoriesService.delete(id);
      reply.send({ success: true, message: 'Categoria removida' });
    },
  });
}
