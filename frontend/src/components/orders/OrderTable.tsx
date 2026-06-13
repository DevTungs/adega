import { useState } from 'react';
import { Order, OrderStatus } from '../../types';
import OrderStatusBadge from './OrderStatusBadge';
import { formatCurrency, formatDateTime, PAYMENT_LABELS } from '../../utils/format';
import { ordersApi } from '../../api/orders';
import toast from 'react-hot-toast';
import { Eye, ChevronRight, X } from 'lucide-react';

interface Props {
  orders: Order[];
  orderType: 'delivery' | 'pdv';
  onStatusChange: (id: string, status: OrderStatus) => void;
  onViewDetails: (order: Order) => void;
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

const NEXT_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'Confirmar',
  confirmed: 'Preparar',
  preparing: 'Pronto',
  ready: 'Enviar',
  out_for_delivery: 'Entregue',
};

export default function OrderTable({ orders, orderType, onStatusChange, onViewDetails }: Props) {
  const isPDV = orderType === 'pdv';
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const handleAdvance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await ordersApi.updateStatus(order.id, next);
      onStatusChange(order.id, next);
      toast.success(`Pedido #${order.order_number} atualizado`);
    } catch {
      toast.error('Erro ao atualizar pedido');
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelOrder) return;
    try {
      await ordersApi.cancel(cancelOrder.id, cancelReason || 'Cancelado pelo admin');
      onStatusChange(cancelOrder.id, 'cancelled');
      toast.success(`Pedido #${cancelOrder.order_number} cancelado`);
      setCancelOrder(null);
      setCancelReason('');
    } catch {
      toast.error('Erro ao cancelar pedido');
    }
  };

  if (orders.length === 0) {
    return (
      <div className="card text-center py-12 text-gray-500">
        Nenhum pedido encontrado
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full">
        <thead className="bg-gray-800/50 border-b border-gray-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Itens</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagamento</th>
            {!isPDV && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3 font-medium text-primary-600">#{order.order_number}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-white">{order.customer_name || 'N/A'}</div>
                {!isPDV && <div className="text-sm text-gray-500">{order.customer_phone}</div>}
              </td>
              <td className="px-4 py-3 text-sm text-gray-400">
                {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'itens'}
              </td>
              <td className="px-4 py-3 font-medium">{formatCurrency(order.total)}</td>
              <td className="px-4 py-3 text-sm text-gray-400">
                {PAYMENT_LABELS[order.payment_method || ''] || 'N/A'}
              </td>
              {!isPDV && (
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
              )}
              <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(order.created_at)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onViewDetails(order)}
                    className="p-1 text-gray-400 hover:text-gray-400"
                    title="Ver detalhes"
                  >
                    <Eye size={18} />
                  </button>
                  {!isPDV && NEXT_STATUS[order.status] && (
                    <button
                      onClick={() => handleAdvance(order)}
                      className="flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 text-sm font-medium"
                    >
                      {NEXT_STATUS_LABEL[order.status]}
                      <ChevronRight size={14} />
                    </button>
                  )}
                  {!isPDV && order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <button
                      onClick={() => { setCancelOrder(order); setCancelReason(''); }}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cancel Modal */}
      {cancelOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">
                Cancelar Pedido #{cancelOrder.order_number}
              </h3>
              <button onClick={() => setCancelOrder(null)} className="p-1 hover:bg-gray-800 rounded text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-3">Motivo do cancelamento:</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Digite o motivo..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setCancelOrder(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
