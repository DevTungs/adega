import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { modifiersService } from './modifiers.service';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const modifierSchema = z.object({
  product_id: z.string().min(1),
  name: z.string().min(1, 'Nome do modificador é obrigatório'),
  type: z.enum(['single', 'multiple', 'required']).optional(),
  min_select: z.number().int().optional(),
  max_select: z.number().int().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.number().int().optional(),
  creates_splits: z.number().int().optional(),
});

const optionSchema = z.object({
  modifier_id: z.string().min(1),
  name: z.string().min(1, 'Nome da opção é obrigatório'),
  price_add: z.number().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.number().int().optional(),
});

export async function registerModifierRoutes(app: FastifyInstance) {
  // List modifiers for a product
  app.get('/api/products/:productId/modifiers', {
    handler: async (request, reply) => {
      const { productId } = request.params as { productId: string };
      const modifiers = await modifiersService.getByProduct(productId);
      reply.send({ success: true, data: modifiers });
    },
  });

  // Get single modifier
  app.get('/api/modifiers/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const mod = await modifiersService.getById(id);
      reply.send({ success: true, data: mod });
    },
  });

  // Create
  app.post('/api/modifiers', {
    preHandler: [authMiddleware, validateBody(modifierSchema)],
    handler: async (request, reply) => {
      const mod = await modifiersService.create(request.body as any);
      reply.status(201).send({ success: true, data: mod });
    },
  });

  // Update
  app.put('/api/modifiers/:id', {
    preHandler: [authMiddleware, validateBody(modifierSchema.partial())],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const mod = await modifiersService.update(id, request.body as any);
      reply.send({ success: true, data: mod });
    },
  });

  // Delete (soft)
  app.delete('/api/modifiers/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await modifiersService.delete(id);
      reply.send({ success: true, message: 'Modificador removido' });
    },
  });

  // --- Option routes ---

  // List options for a modifier
  app.get('/api/modifiers/:modifierId/options', {
    handler: async (request, reply) => {
      const { modifierId } = request.params as { modifierId: string };
      const options = await modifiersService.getOptions(modifierId);
      reply.send({ success: true, data: options });
    },
  });

  // Create option
  app.post('/api/modifier-options', {
    preHandler: [authMiddleware, validateBody(optionSchema)],
    handler: async (request, reply) => {
      const opt = await modifiersService.createOption(request.body as any);
      reply.status(201).send({ success: true, data: opt });
    },
  });

  // Update option
  app.put('/api/modifier-options/:id', {
    preHandler: [authMiddleware, validateBody(optionSchema.partial())],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const opt = await modifiersService.updateOption(id, request.body as any);
      reply.send({ success: true, data: opt });
    },
  });

  // Delete option
  app.delete('/api/modifier-options/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await modifiersService.deleteOption(id);
      reply.send({ success: true, message: 'Opção removida' });
    },
  });
}
