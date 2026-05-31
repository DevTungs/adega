import { useEffect, useState } from 'react';
import { useOrderStore } from '../../stores/orderStore';
import OrderTable from './OrderTable';
import OrderDetails from './OrderDetails';
import { Order, OrderStatus } from '../../types';
import { STATUS_LABELS } from '../../utils/format';

const STATUS_OPTIONS: (OrderStatus | '')[] = ['', 'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

interface Props {
  orderType: 'delivery' | 'pdv';
  title: string;
}

export default function OrdersPage({ orderType, title }: Props) {
  const { orders, fetchOrders, isLoading, statusFilter, setStatusFilter } = useOrderStore();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchOrders({ order_type: orderType });
  }, [fetchOrders, orderType]);

  const handleStatusChange = (id: string, status: OrderStatus) => {
    setSelectedOrder(prev => prev && prev.id === id ? { ...prev, status } : prev);
    fetchOrders({ order_type: orderType });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
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
          <button onClick={() => fetchOrders({ order_type: orderType })} className="btn-secondary">
            Atualizar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="card text-center py-12">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Nenhum pedido encontrado
        </div>
      ) : (
        <OrderTable
          orders={orders}
          onStatusChange={handleStatusChange}
          onViewDetails={setSelectedOrder}
        />
      )}

      {selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
