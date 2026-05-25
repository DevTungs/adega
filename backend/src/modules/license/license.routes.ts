import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../auth/auth.middleware';
import { validateBody } from '../../shared/middlewares/validation';
import { licenseService } from './license.service';

const activateLicenseSchema = z.object({
  licenseKey: z.string().min(8, 'Informe a chave da licença'),
});

export async function registerLicenseRoutes(app: FastifyInstance) {
  app.get('/api/license/status', {
    preHandler: [authMiddleware],
    handler: async (_request, reply) => {
      reply.send({ success: true, data: licenseService.getStatus() });
    },
  });

  app.post('/api/license/activate', {
    preHandler: [authMiddleware, validateBody(activateLicenseSchema)],
    handler: async (request, reply) => {
      const { licenseKey } = request.body as z.infer<typeof activateLicenseSchema>;
      const status = await licenseService.activate(licenseKey);
      if (status.status !== 'active') {
        reply.status(400);
      }
      reply.send({ success: status.status === 'active', data: status, message: status.message || (status.status === 'active' ? 'Licença ativada com sucesso' : 'Falha na ativação') });
    },
  });

  app.post('/api/license/validate', {
    preHandler: [authMiddleware],
    handler: async (_request, reply) => {
      const status = await licenseService.validateCurrent(true);
      reply.send({ success: true, data: status });
    },
  });
}
