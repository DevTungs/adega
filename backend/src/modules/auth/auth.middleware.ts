import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTPayload } from '../../shared/types';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Token não fornecido',
      });
    }
    const decoded = request.server.jwt.verify(token) as JWTPayload;
    (request as any).user = decoded;
  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Token inválido ou expirado',
    });
  }
}

export function getUser(request: FastifyRequest): JWTPayload {
  return (request as any).user as JWTPayload;
}
