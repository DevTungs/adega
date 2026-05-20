import rateLimit from '@fastify/rate-limit';
import { FastifyInstance } from 'fastify';

export async function setupRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
    },
  });
}
