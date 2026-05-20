import { useEffect, useState } from 'react';
import { useOrderStore } from '../stores/orderStore';
import OrderTable from '../components/orders/OrderTable';
import OrderDetails from '../components/orders/OrderDetails';
import { Order, OrderStatus } from '../types';
import { STATUS_LABELS } from '../utils/format';

const STATUS_OPTIONS: (OrderStatus | '')[] = ['', 'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

export default function Orders() {
  const { orders, fetchOrders, isLoading, statusFilter, setStatusFilter } = useOrderStore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = (id: string, status: OrderStatus) => {
    // Update selectedOrder if it's the one that changed
    setSelectedOrder(prev => prev && prev.id === id ? { ...prev, status } : prev);
    // Refresh the list from server
    fetchOrders();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
            className="input w-auto"
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s!]}</option>
            ))}
          </select>
          <button onClick={() => fetchOrders()} className="btn-secondary">
            Atualizar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-500 mt-4">Carregando pedidos...</p>
        </div>
      ) : (
        <OrderTable
          orders={orders}
          onStatusChange={handleStatusChange}
          onViewDetails={setSelectedOrder}
        />
      )}

      {selectedOrder && (
        <OrderDetails order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}
