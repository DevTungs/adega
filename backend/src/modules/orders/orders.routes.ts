import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ordersService } from './orders.service';
import { authMiddleware, getUser } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const createOrderSchema = z.object({
  customer_id: z.string().min(1),
  items: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
  })).min(1, 'Pedido deve ter pelo menos 1 item'),
  payment_method: z.string().optional(),
  delivery_address: z.string().optional(),
  delivery_notes: z.string().optional(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']),
  notes: z.string().optional(),
});

const assignDriverSchema = z.object({
  driver_id: z.string().min(1),
});

export async function registerOrderRoutes(app: FastifyInstance) {
  // List all
  app.get('/api/orders', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { status, customer_id, date_from, date_to, limit, offset } = request.query as any;
      const result = await ordersService.getAll({
        status,
        customer_id,
        date_from,
        date_to,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
      });
      reply.send({ success: true, data: result.orders, total: result.total });
    },
  });

  // Get by ID
  app.get('/api/orders/:id', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const order = await ordersService.getById(id);
      reply.send({ success: true, data: order });
    },
  });

  // Create
  app.post('/api/orders', {
    preHandler: [authMiddleware, validateBody(createOrderSchema)],
    handler: async (request, reply) => {
      const order = await ordersService.create(request.body as any);
      reply.status(201).send({ success: true, data: order });
    },
  });

  // Update status
  app.patch('/api/orders/:id/status', {
    preHandler: [authMiddleware, validateBody(updateStatusSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status, notes } = request.body as z.infer<typeof updateStatusSchema>;
      const user = getUser(request);
      const order = await ordersService.updateStatus(id, status, user.username, notes);
      reply.send({ success: true, data: order });
    },
  });

  // Assign driver
  app.patch('/api/orders/:id/assign', {
    preHandler: [authMiddleware, validateBody(assignDriverSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { driver_id } = request.body as z.infer<typeof assignDriverSchema>;
      const order = await ordersService.assignDriver(id, driver_id);
      reply.send({ success: true, data: order });
    },
  });

  // Cancel
  app.post('/api/orders/:id/cancel', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };
      const user = getUser(request);
      const order = await ordersService.cancel(id, reason || 'Cancelado pelo admin', user.username);
      reply.send({ success: true, data: order });
    },
  });

  // Timeline
  app.get('/api/orders/:id/timeline', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const timeline = await ordersService.getTimeline(id);
      reply.send({ success: true, data: timeline });
    },
  });

  // Stats
  app.get('/api/reports/dashboard', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { date_from, date_to } = request.query as any;
      const stats = await ordersService.getStats(date_from, date_to);
      reply.send({ success: true, data: stats });
    },
  });
}
