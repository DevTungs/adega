import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cashRegisterService } from './cash-register.service';
import { authMiddleware, getUser } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';

const openSchema = z.object({
  opening_amount: z.number().min(0, 'Valor de abertura deve ser >= 0'),
});

const closeSchema = z.object({
  closing_amount: z.number().min(0, 'Valor de fechamento deve ser >= 0'),
});

const movementSchema = z.object({
  type: z.enum(['sangria', 'suprimento']),
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().optional(),
});

export async function registerCashRegisterRoutes(app: FastifyInstance) {
  // Get current open register
  app.get('/api/cash-register/current', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const summary = await cashRegisterService.getCurrent();
      reply.send({ success: true, data: summary });
    },
  });

  // Open register
  app.post('/api/cash-register/open', {
    preHandler: [authMiddleware, validateBody(openSchema)],
    handler: async (request, reply) => {
      const { opening_amount } = request.body as z.infer<typeof openSchema>;
      const user = getUser(request);
      const summary = await cashRegisterService.open(user.username, opening_amount);
      reply.status(201).send({ success: true, data: summary });
    },
  });

  // Close register
  app.post('/api/cash-register/close', {
    preHandler: [authMiddleware, validateBody(closeSchema)],
    handler: async (request, reply) => {
      const { closing_amount } = request.body as z.infer<typeof closeSchema>;
      const open = await cashRegisterService.getCurrent();
      if (!open) {
        return reply.status(400).send({ success: false, error: 'Nenhum caixa aberto' });
      }
      const summary = await cashRegisterService.close(open.register.id, closing_amount);
      reply.send({ success: true, data: summary });
    },
  });

  // Add sangria/suprimento
  app.post('/api/cash-register/movement', {
    preHandler: [authMiddleware, validateBody(movementSchema)],
    handler: async (request, reply) => {
      const { type, amount, description } = request.body as z.infer<typeof movementSchema>;
      const summary = await cashRegisterService.addMovement(type, amount, description);
      reply.send({ success: true, data: summary });
    },
  });

  // Get summary by ID
  app.get('/api/cash-register/:id/summary', {
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const summary = await cashRegisterService.getSummary(id);
      reply.send({ success: true, data: summary });
    },
  });
}
