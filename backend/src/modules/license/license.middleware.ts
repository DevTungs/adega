import { FastifyReply, FastifyRequest } from 'fastify';
import { licenseService } from './license.service';

export async function licenseOrderMiddleware(_request: FastifyRequest, _reply: FastifyReply) {
  await licenseService.ensureCanCreateOrder();
}
