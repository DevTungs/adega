import { Order } from '../../types';
import OrderStatusBadge from './OrderStatusBadge';
import { formatCurrency, formatDateTime, PAYMENT_LABELS, STATUS_LABELS } from '../../utils/format';
import { X } from 'lucide-react';

interface Props {
  order: Order;
  onClose: () => void;
}

export default function OrderDetails({ order, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-bold">Pedido #{order.order_number}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <OrderStatusBadge status={order.status} />
            <span className="text-sm text-gray-500">{formatDateTime(order.created_at)}</span>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-2">Cliente</h4>
            <p className="text-gray-900">{order.customer_name || 'N/A'}</p>
            <p className="text-sm text-gray-500">{order.customer_phone}</p>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-2">Itens</h4>
            <div className="space-y-2">
              {order.items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.product_name}</span>
                  <span className="font-medium">{formatCurrency(item.total_price)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            {order.delivery_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span>Taxa de entrega</span>
                <span>{formatCurrency(order.delivery_fee)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg mt-2">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>

          {order.delivery_address && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Endereço</h4>
              <p className="text-sm text-gray-600">{order.delivery_address}</p>
            </div>
          )}

          {order.payment_method && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Pagamento</h4>
              <p className="text-sm text-gray-600">{PAYMENT_LABELS[order.payment_method] || order.payment_method}</p>
            </div>
          )}

          {order.notes && (
            <div>
              <h4 className="font-medium text-gray-700 mb-1">Observações</h4>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
