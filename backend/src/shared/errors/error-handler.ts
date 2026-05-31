import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './app-error';
import { ZodError } from 'zod';

export function setupErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error(error);

    if (error instanceof AppError || (error.statusCode && error.code)) {
      return reply.status(error.statusCode || 500).send({
        success: false,
        error: error.code || 'ERROR',
        message: error.message || 'Erro interno do servidor',
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: 'RATE_LIMIT',
        message: 'Muitas requisições. Tente novamente em instantes.',
      });
    }

    return reply.status(500).send({
      success: false,
      error: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno do servidor',
    });
  });
}
