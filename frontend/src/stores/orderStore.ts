import { create } from 'zustand';
import { Order, OrderStatus } from '../types';
import { ordersApi } from '../api/orders';

interface OrderState {
  orders: Order[];
  selectedOrder: Order | null;
  total: number;
  isLoading: boolean;
  statusFilter: OrderStatus | '';
  typeFilter: string;
  fetchOrders: (params?: { status?: string; order_type?: string; limit?: number; offset?: number }) => Promise<void>;
  fetchOrderById: (id: string) => Promise<void>;
  updateStatus: (id: string, status: OrderStatus, notes?: string) => Promise<void>;
  setStatusFilter: (status: OrderStatus | '') => void;
  setTypeFilter: (type: string) => void;
  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  selectedOrder: null,
  total: 0,
  isLoading: false,
  statusFilter: '',
  typeFilter: '',

  fetchOrders: async (params) => {
    set({ isLoading: true });
    try {
      const { statusFilter, typeFilter } = get();
      const { data } = await ordersApi.getAll({
        status: params?.status || statusFilter || undefined,
        order_type: params?.order_type || typeFilter || undefined,
        limit: params?.limit || 50,
        offset: params?.offset || 0,
      });
      set({ orders: data.data, total: data.total, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchOrderById: async (id) => {
    try {
      const { data } = await ordersApi.getById(id);
      set({ selectedOrder: data.data });
    } catch {}
  },

  updateStatus: async (id, status, notes) => {
    try {
      await ordersApi.updateStatus(id, status, notes);
      const { orders, selectedOrder } = get();
      set({
        orders: orders.map((o) =>
          o.id === id ? { ...o, status } : o
        ),
        selectedOrder: selectedOrder?.id === id
          ? { ...selectedOrder, status }
          : selectedOrder,
      });
    } catch (error) {
      throw error;
    }
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status });
    get().fetchOrders({ status: status || undefined });
  },

  setTypeFilter: (type) => {
    set({ typeFilter: type });
    get().fetchOrders({ order_type: type || undefined });
  },

  addOrder: (order) => {
    set((state) => ({
      orders: [order, ...state.orders],
      total: state.total + 1,
    }));
  },

  updateOrder: (order) => {
    set((state) => ({
      orders: state.orders.map((o) => (o.id === order.id ? order : o)),
      selectedOrder: state.selectedOrder?.id === order.id ? order : state.selectedOrder,
    }));
  },
}));
