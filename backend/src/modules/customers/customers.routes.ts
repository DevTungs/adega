import { FastifyInstance } from 'fastify';
import { customersService } from './customers.service';
import { authMiddleware } from '../auth/auth.middleware';

export async function registerCustomerRoutes(app: FastifyInstance) {
  // List all
  app.get('/api/customers', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { search } = request.query as any;
      const customers = await customersService.getAll({ search });
      reply.send({ success: true, data: customers });
    },
  });

  // Get by ID
  app.get('/api/customers/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const customer = await customersService.getById(id);
      reply.send({ success: true, data: customer });
    },
  });

  // Get customer orders
  app.get('/api/customers/:id/orders', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { limit } = request.query as any;
      const orders = await customersService.getOrders(id, limit ? parseInt(limit) : undefined);
      reply.send({ success: true, data: orders });
    },
  });

  // Update
  app.patch('/api/customers/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const customer = await customersService.update(id, request.body as any);
      reply.send({ success: true, data: customer });
    },
  });

  // Update by phone number (used by WhatsApp messages page)
  app.patch('/api/customers/phone/:phone', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { phone } = request.params as { phone: string };
      const customer = await customersService.updateByPhone(phone, request.body as any);
      reply.send({ success: true, data: customer });
    },
  });
}
