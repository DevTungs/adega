import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { suppliersService } from './suppliers.service';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const supplierSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.number().int().optional(),
});

export async function registerSupplierRoutes(app: FastifyInstance) {
  app.get('/api/suppliers', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { search } = request.query as any;
      const suppliers = await suppliersService.getAll({ search });
      reply.send({ success: true, data: suppliers });
    },
  });

  app.get('/api/suppliers/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const supplier = await suppliersService.getById(id);
      reply.send({ success: true, data: supplier });
    },
  });

  app.post('/api/suppliers', {
    preHandler: [authMiddleware, validateBody(supplierSchema)],
    handler: async (request, reply) => {
      const supplier = await suppliersService.create(request.body as any);
      reply.status(201).send({ success: true, data: supplier });
    },
  });

  app.put('/api/suppliers/:id', {
    preHandler: [authMiddleware, validateBody(supplierSchema.partial())],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const supplier = await suppliersService.update(id, request.body as any);
      reply.send({ success: true, data: supplier });
    },
  });

  app.delete('/api/suppliers/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      await suppliersService.delete(id);
      reply.send({ success: true, message: 'Fornecedor removido' });
    },
  });
}
