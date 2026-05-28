import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { stockService } from './stock.service';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const receiveStockSchema = z.object({
  product_id: z.string().min(1, 'Produto é obrigatório'),
  quantity: z.number().int().positive('Quantidade deve ser positiva'),
  cost_price: z.number().positive().optional(),
  supplier_name: z.string().optional(),
  notes: z.string().optional(),
  invoice_number: z.string().optional(),
});

export async function registerStockRoutes(app: FastifyInstance) {
  // List movements with filters
  app.get('/api/stock/movements', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { product_id, type, date_from, date_to, limit, offset } = request.query as any;
      const result = await stockService.getAll({
        product_id,
        type,
        date_from,
        date_to,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });
      reply.send({ success: true, data: result.movements, total: result.total });
    },
  });

  // Get movements by product
  app.get('/api/stock/movements/product/:productId', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { productId } = request.params as { productId: string };
      const result = await stockService.getByProduct(productId);
      reply.send({ success: true, data: result });
    },
  });

  // Get summary (entries today, exits today, inventory value, low stock)
  app.get('/api/stock/summary', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const summary = await stockService.getSummary();
      reply.send({ success: true, data: summary });
    },
  });

  // Receive stock (purchase entry)
  app.post('/api/stock/receive', {
    preHandler: [authMiddleware, validateBody(receiveStockSchema)],
    handler: async (request, reply) => {
      const user = (request as any).user;
      const result = await stockService.receiveStock({
        ...request.body as z.infer<typeof receiveStockSchema>,
        created_by: user?.name || user?.username || 'admin',
      });
      reply.status(201).send({ success: true, data: result });
    },
  });
}
