import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../../shared/middlewares/logger';

let io: SocketIOServer;

export function setupWebSocket(app: FastifyInstance) {
  io = new SocketIOServer(app.server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'WebSocket client connected');

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'WebSocket client disconnected');
    });
  });

  logger.info('[WebSocket] Server initialized');
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('WebSocket not initialized');
  return io;
}

// Emit events
export function emitOrderNew(order: any) {
  if (io) io.emit('order:new', order);
}

export function emitOrderStatusChanged(orderId: string, status: string) {
  if (io) io.emit('order:status_changed', { orderId, status });
}

export function emitOrderUpdated(order: any) {
  if (io) io.emit('order:updated', order);
}

export function emitStatsUpdate(stats: any) {
  if (io) io.emit('stats:update', stats);
}

export function emitSystemAlert(alert: any) {
  if (io) io.emit('system:alert', alert);
}

// WhatsApp events
export function emitWAQR(qrDataUrl: string) {
  if (io) io.emit('wa:qr', { qr: qrDataUrl });
}

export function emitWAStatus(status: string) {
  if (io) io.emit('wa:status', { status });
}

export function emitWAMessage(phone: string, message: string, direction: 'in' | 'out') {
  if (io) io.emit('wa:message', { phone, message, direction, time: new Date().toISOString() });
}
