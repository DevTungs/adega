import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../../shared/middlewares/logger';
import { config } from '../../config/app.config';

let io: SocketIOServer;

export function setupWebSocket(app: FastifyInstance) {
  io = new SocketIOServer(app.server, {
    cors: {
      origin: config.frontendUrl,
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

// Stock alerts
export function emitStockLow(product: { id: string; name: string; stock: number; min_stock: number }) {
  if (io) io.emit('stock:low', product);
}

// Agent request
export function emitAgentRequest(phone: string, customerName: string) {
  if (io) io.emit('wa:agent_request', { phone, customerName, time: new Date().toISOString() });
}

// PIX pending confirmation
export function emitPixPending(phone: string, customerName: string, total: number) {
  if (io) io.emit('pix:pending', { phone, customerName, total, time: new Date().toISOString() });
}

// WhatsApp events
export function emitWAQR(qrDataUrl: string) {
  if (io) io.emit('wa:qr', { qr: qrDataUrl });
}

export function emitWAStatus(status: string) {
  if (io) io.emit('wa:status', { status });
}

export function emitWAMessage(phone: string, message: string, direction: 'in' | 'out', name?: string | null) {
  if (io) io.emit('wa:message', { phone, message, direction, time: new Date().toISOString(), name });
}
