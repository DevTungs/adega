import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useOrderStore } from '../stores/orderStore';
import toast from 'react-hot-toast';

// Detect if running in Electron (file:// protocol)
const isElectron = window.location.protocol === 'file:';
const wsOrigin = isElectron ? 'http://localhost:3333' : window.location.origin;

export interface PixPendingData {
  phone: string;
  customerName: string;
  total: number;
  imageBase64?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  address?: string;
  notes?: string;
  deliveryFee?: number;
  time: string;
}

export interface AgentRequestData {
  phone: string;
  customerName: string;
  time: string;
}

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { addOrder, updateOrder } = useOrderStore();
  const [pixPending, setPixPending] = useState<PixPendingData | null>(null);
  const [pixQueue, setPixQueue] = useState<PixPendingData[]>([]);
  const [agentRequest, setAgentRequest] = useState<AgentRequestData | null>(null);
  const [agentQueue, setAgentQueue] = useState<AgentRequestData[]>([]);

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
        icon: '',
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

    socket.on('pix:pending', (data: PixPendingData) => {
      setPixQueue(prev => {
        const existing = prev.findIndex(p => p.phone === data.phone);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = data;
          return updated;
        }
        return [...prev, data];
      });
      setPixPending(data);
      toast.success(`Comprovante PIX de ${data.customerName}!`, {
        icon: '💳',
        duration: 8000,
      });
      try {
        const audio = new Audio('/sounds/notification.wav');
        audio.play().catch(() => {});
      } catch {}
    });

    socket.on('wa:agent_request', (data: AgentRequestData) => {
      setAgentQueue(prev => {
        const existing = prev.findIndex(p => p.phone === data.phone);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = data;
          return updated;
        }
        return [...prev, data];
      });
      setAgentRequest(data);
      toast.success(`Atendente solicitado por ${data.customerName}!`, {
        icon: '👤',
        duration: 8000,
      });
      try {
        const audio = new Audio('/sounds/notification.wav');
        audio.play().catch(() => {});
      } catch {}
    });

    return () => {
      socket.disconnect();
    };
  }, [addOrder, updateOrder]);

  const dismissPix = useCallback(() => {
    setPixPending(null);
    setPixQueue(prev => {
      const next = prev.slice(1);
      if (next.length > 0) {
        setPixPending(next[0]);
      }
      return next;
    });
  }, []);

  const dismissAgent = useCallback(() => {
    setAgentRequest(null);
    setAgentQueue(prev => {
      const next = prev.slice(1);
      if (next.length > 0) {
        setAgentRequest(next[0]);
      }
      return next;
    });
  }, []);

  return { socket: socketRef.current, pixPending, dismissPix, pixQueue, agentRequest, dismissAgent, agentQueue, setAgentQueue };
}
