import { useState, useMemo } from 'react';
import { Order, PaymentSplit } from '../../types';
import OrderStatusBadge from './OrderStatusBadge';
import { formatCurrency, formatDateTime, PAYMENT_LABELS, STATUS_LABELS } from '../../utils/format';
import { X, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

interface Props {
  order: Order;
  orderType: 'delivery' | 'pdv';
  onClose: () => void;
}

export default function OrderDetails({ order, orderType, onClose }: Props) {
  const isPDV = orderType === 'pdv';
  const [printing, setPrinting] = useState(false);

  const paymentSplits: PaymentSplit[] = useMemo(() => {
    try {
      return order.payment_splits ? JSON.parse(order.payment_splits) : [];
    } catch {
      return [];
    }
  }, [order.payment_splits]);

  const hasSplits = paymentSplits.length > 0;

  // Map each order item to its split
  const itemsBySplit = useMemo(() => {
    if (!hasSplits) return null;
    const splitMap: Record<number, { split: PaymentSplit; items: typeof order.items }> = {};
    const usedCounters: Record<string, number> = {};

    for (let si = 0; si < paymentSplits.length; si++) {
      splitMap[si] = { split: paymentSplits[si], items: [] };
    }

    for (const item of order.items || []) {
      const pid = item.product_id;
      const key = usedCounters[pid] || 0;
      usedCounters[pid] = key + 1;

      // Find which split this item belongs to by matching product_id order
      let assigned = false;
      for (let si = 0; si < paymentSplits.length; si++) {
        const split = paymentSplits[si];
        const occurrencesBefore = paymentSplits
          .slice(0, si)
          .reduce((sum, s) => sum + s.product_ids.filter(id => id === pid).length, 0);
        const countInThisSplit = split.product_ids.filter(id => id === pid).length;
        const startIdx = occurrencesBefore;
        const endIdx = startIdx + countInThisSplit;
        if (key >= startIdx && key < endIdx) {
          splitMap[si].items.push(item);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        // Fallback: put in first split
        splitMap[0]?.items.push(item);
      }
    }
    return splitMap;
  }, [order.items, paymentSplits, hasSplits]);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/print`);
      if (data.success) {
        toast.success('Cupom enviado para impressão!');
      } else {
        toast.error(data.message || 'Erro ao imprimir');
      }
    } catch {
      toast.error('Erro ao imprimir');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-bold">Pedido #{order.order_number}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={printing}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
              title="Imprimir cupom"
            >
              <Printer size={20} className={printing ? 'animate-pulse' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            {!isPDV && <OrderStatusBadge status={order.status} />}
            <span className="text-sm text-gray-500">{formatDateTime(order.created_at)}</span>
          </div>

          <div>
            <h4 className="font-medium text-gray-300 mb-2">Cliente</h4>
            <p className="text-white">{order.customer_name || 'N/A'}</p>
            {!isPDV && <p className="text-sm text-gray-500">{order.customer_phone}</p>}
          </div>

          {hasSplits && itemsBySplit ? (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-300">Itens (Dividido)</h4>
              {Object.values(itemsBySplit).map(({ split, items }, si) => (
                <div key={si} className="bg-gray-800/50 rounded-xl p-4 border border-primary-700/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-bold text-white text-sm">{split.label}</p>
                    <span className="text-xs text-gray-400">
                      {PAYMENT_LABELS[split.payment_method] || split.payment_method}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-300">{item.quantity}x {item.product_name}</span>
                        <span className="font-medium text-white">{formatCurrency(item.total_price)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-gray-700">
                    <span className="text-gray-400">Total {split.label}</span>
                    <span className="text-primary-600">{formatCurrency(split.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <h4 className="font-medium text-gray-300 mb-2">Itens</h4>
              <div className="space-y-2">
                {order.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span className="font-medium">{formatCurrency(item.total_price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              <h4 className="font-medium text-gray-300 mb-1">Endereço</h4>
              <p className="text-sm text-gray-400">{order.delivery_address}</p>
            </div>
          )}

          {!hasSplits && order.payment_method && (
            <div>
              <h4 className="font-medium text-gray-300 mb-1">Pagamento</h4>
              <p className="text-sm text-gray-400">{PAYMENT_LABELS[order.payment_method] || order.payment_method}</p>
            </div>
          )}

          {order.notes && (
            <div>
              <h4 className="font-medium text-gray-300 mb-1">Observações</h4>
              <p className="text-sm text-gray-400">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
