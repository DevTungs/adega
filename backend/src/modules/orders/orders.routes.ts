import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ordersService } from './orders.service';
import { customersService } from '../customers/customers.service';
import { printerService } from '../../services/printer/printer.service';
import { settingsAgent } from '../../services/settings/settings.service';
import { authMiddleware, getUser } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';
import { licenseOrderMiddleware } from '../license/license.middleware';
import { whatsappSessionService } from '../whatsapp/whatsapp.service';
import { messageFormatter } from '../whatsapp/whatsapp.formatter';
import { baileysService } from '../../services/whatsapp/baileys.service';
import { logger } from '../../shared/middlewares/logger';

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
    product_id: z.string().optional(),
    product_name: z.string().optional(),
    unit_price: z.number().optional(),
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
      const order = await ordersService.cancel(id, reason || 'Infelizmente não conseguimos concluir o pedido', user.username);
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

  // PIX: Confirm payment — create order from pending session
  app.post('/api/orders/confirm-pix', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { phone } = request.body as { phone: string };
      if (!phone) return reply.status(400).send({ success: false, message: 'phone is required' });

      try {
        const session = await whatsappSessionService.getOrCreate(phone);
        const context = JSON.parse(session.context || '{}');

        if (!context.items || context.items.length === 0) {
          return reply.status(400).send({ success: false, message: 'Carrinho vazio' });
        }

        // Create customer if needed
        const customer = await customersService.getOrCreateByPhone(phone);
        if (context.customerName) {
          await customersService.update(customer.id, { name: context.customerName });
        }

        // Build order items
        const items = (context.items || []).map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          variant_id: item.variant_id || undefined,
          halves: item.halves || undefined,
          modifiers: item.modifiers || undefined,
        }));

        const deliveryFee = settingsAgent.calculateTimeBasedDeliveryFee();
        const result = await ordersService.create({
          customer_id: customer.id,
          items,
          payment_method: 'pix',
          delivery_address: context.address || '',
          notes: context.notes || undefined,
          order_type: 'delivery',
        });

        const { order, stockWarnings } = result as any;

        // Advance status to confirmed
        const confirmedOrder = await ordersService.updateStatus(order.id, 'confirmed', 'system', 'Pagamento PIX confirmado.');

        // Notify customer
        const msg = `✅ *Pagamento #${confirmedOrder.order_number} Confirmado!*`;
        try { await baileysService.sendMessage(phone, msg); } catch (e: any) { logger.error({ error: e?.message }, 'Failed to send PIX confirm notification'); }

        // Reset session, keeping lastOrder for status tracking
        await whatsappSessionService.updateState(phone, 'order_placed', {
          lastOrderId: order.id,
          lastOrderNumber: order.order_number,
        });

        reply.send({ success: true, data: order });
      } catch (err: any) {
        logger.error({ error: err.message, phone }, 'PIX confirm failed');
        reply.status(500).send({ success: false, message: err.message });
      }
    },
  });

  // PIX: Reject payment — cancel pending order
  app.post('/api/orders/reject-pix', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { phone } = request.body as { phone: string };
      if (!phone) return reply.status(400).send({ success: false, message: 'phone is required' });

      try {
        const session = await whatsappSessionService.getOrCreate(phone);

        try { await baileysService.sendMessage(phone, messageFormatter.pixRejected()); } catch (e: any) { logger.error({ error: e?.message }, 'Failed to send PIX reject notification'); }

        await whatsappSessionService.resetSession(phone);
        reply.send({ success: true, message: 'PIX rejeitado' });
      } catch (err: any) {
        logger.error({ error: err.message, phone }, 'PIX reject failed');
        reply.status(500).send({ success: false, message: err.message });
      }
    },
  });
}
