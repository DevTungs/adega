import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../auth/auth.middleware';
import { reportsModel } from './reports.model';

export async function registerReportRoutes(app: FastifyInstance) {
  app.get('/api/reports/sales', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { period, date_from, date_to, order_type } = request.query as any;
      const filters = { date_from, date_to, order_type };

      const [summary, byPeriod, byPayment] = await Promise.all([
        reportsModel.getSalesSummary(filters),
        reportsModel.getSalesByPeriod(period || 'day', filters),
        reportsModel.getSalesByPaymentMethod(filters),
      ]);

      reply.send({ success: true, data: { summary, byPeriod, byPayment } });
    },
  });

  app.get('/api/reports/products/top', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { limit, sort, date_from, date_to, order_type } = request.query as any;
      const products = reportsModel.getTopProducts(
        parseInt(limit) || 10,
        sort || 'quantity',
        { date_from, date_to, order_type }
      );
      reply.send({ success: true, data: products });
    },
  });

  app.get('/api/reports/categories', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { date_from, date_to, order_type } = request.query as any;
      const categories = reportsModel.getSalesByCategory({ date_from, date_to, order_type });
      reply.send({ success: true, data: categories });
    },
  });

  app.get('/api/reports/customers/top', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { limit, order_type } = request.query as any;
      const customers = reportsModel.getTopCustomers(parseInt(limit) || 10, order_type);
      reply.send({ success: true, data: customers });
    },
  });

  app.get('/api/reports/inventory/valuation', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const valuation = reportsModel.getInventoryValuation();
      reply.send({ success: true, data: valuation });
    },
  });

  app.get('/api/reports/inventory/low-stock', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const products = reportsModel.getLowStockProducts();
      reply.send({ success: true, data: products });
    },
  });

  app.get('/api/reports/inventory/by-category', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const categories = reportsModel.getInventoryByCategory();
      reply.send({ success: true, data: categories });
    },
  });

  app.get('/api/reports/profit', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { date_from, date_to, order_type } = request.query as any;
      const profit = reportsModel.getProfit({ date_from, date_to, order_type });
      reply.send({ success: true, data: profit });
    },
  });

  app.get('/api/reports/hours', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { date_from, date_to, order_type } = request.query as any;
      const hours = reportsModel.getOrdersByHour({ date_from, date_to, order_type });
      reply.send({ success: true, data: hours });
    },
  });

  app.get('/api/reports/comparison', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { date_from, date_to, order_type } = request.query as any;
      const comparison = reportsModel.getComparison({ date_from, date_to, order_type });
      reply.send({ success: true, data: comparison });
    },
  });
}
