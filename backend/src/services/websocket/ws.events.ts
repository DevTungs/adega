import { Socket } from 'socket.io';
import { ordersService } from '../../modules/orders/orders.service';
import { logger } from '../../shared/middlewares/logger';

export function setupSocketEvents(socket: Socket) {
  socket.on('order:accept', async (data: { orderId: string }) => {
    try {
      const order = await ordersService.updateStatus(data.orderId, 'confirmed', 'dashboard');
      socket.emit('order:updated', order);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('order:change_status', async (data: { orderId: string; status: string }) => {
    try {
      const order = await ordersService.updateStatus(data.orderId, data.status as any, 'dashboard');
      socket.emit('order:updated', order);
    } catch (error: any) {
      socket.emit('error', { message: error.message });
    }
  });
}
