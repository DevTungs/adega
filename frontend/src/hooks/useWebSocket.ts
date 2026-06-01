import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useOrderStore } from '../stores/orderStore';
import toast from 'react-hot-toast';

// Detect if running in Electron (file:// protocol)
const isElectron = window.location.protocol === 'file:';
const wsOrigin = isElectron ? 'http://localhost:3333' : window.location.origin;

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { addOrder, updateOrder } = useOrderStore();

  useEffect(() => {
    const socket = io(wsOrigin, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected');
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });

    socket.on('order:new', (order) => {
      addOrder(order);
      toast.success(`Novo pedido #${order.order_number}!`, {
        icon: '🔔',
        duration: 5000,
      });
      // Play sound
      try {
        const audio = new Audio('/sounds/notification.wav');
        audio.play().catch(() => {});
      } catch {}
    });

    socket.on('order:status_changed', ({ orderId, status }) => {
      // Only update the status field, don't replace the entire order
      const { orders, selectedOrder } = useOrderStore.getState();
      useOrderStore.setState({
        orders: orders.map((o) =>
          o.id === orderId ? { ...o, status } : o
        ),
        selectedOrder: selectedOrder?.id === orderId
          ? ({ ...selectedOrder, status } as typeof selectedOrder)
          : selectedOrder,
      });
    });

    socket.on('order:updated', (order) => {
      updateOrder(order);
    });

    socket.on('system:alert', (alert) => {
      toast.error(alert.message || 'Alerta do sistema');
    });

    return () => {
      socket.disconnect();
    };
  }, [addOrder, updateOrder]);

  return socketRef.current;
}
