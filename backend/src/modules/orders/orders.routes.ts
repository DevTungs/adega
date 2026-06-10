import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ordersService } from './orders.service';
import { printerService } from '../../services/printer/printer.service';
import { authMiddleware, getUser } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';
import { licenseOrderMiddleware } from '../license/license.middleware';

const paymentSplitSchema = z.object({
  label: z.string().min(1),
  product_ids: z.array(z.string().min(1)).min(1),
  payment_method: z.string().min(1),
  total: z.number().min(0),
});

const halfSchema = z.object({
  product_id: z.string().min(1),
  product_name: z.string().min(1),
});

const itemModifierSchema = z.object({
  modifier_id: z.string().min(1),
  option_id: z.string().min(1),
  option_name: z.string().min(1),
  price_add: z.number(),
});

const createOrderSchema = z.object({
  customer_id: z.string().min(1),
  items: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
    variant_id: z.string().optional(),
    halves: z.array(halfSchema).optional(),
    modifiers: z.array(itemModifierSchema).optional(),
  })).min(1, 'Pedido deve ter pelo menos 1 item'),
  payment_method: z.string().optional(),
  payment_splits: z.array(paymentSplitSchema).optional(),
  delivery_address: z.string().optional(),
  delivery_notes: z.string().optional(),
  notes: z.string().optional(),
  order_type: z.enum(['pdv', 'delivery']).optional(),
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
      const { status, customer_id, date_from, date_to, order_type, limit, offset } = request.query as any;
      const result = await ordersService.getAll({
        status,
        customer_id,
        date_from,
        date_to,
        order_type,
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
    preHandler: [authMiddleware, validateBody(createOrderSchema), licenseOrderMiddleware],
    handler: async (request, reply) => {
      const result = await ordersService.create(request.body as any);
      const { order, stockWarnings } = result as any;
      reply.status(201).send({ success: true, data: order, stockWarnings });
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

  // Print
  app.post('/api/orders/:id/print', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const order = await ordersService.getById(id);
        const success = await printerService.printOrder(order);
        reply.send({ success, message: success ? 'Cupom enviado para impressão' : 'Falha na impressão' });
      } catch (err: any) {
        reply.status(500).send({ success: false, message: err.message });
      }
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
