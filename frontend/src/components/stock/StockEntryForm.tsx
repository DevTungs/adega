import { useState } from 'react';
import { stockApi } from '../../api/stock';
import { Product } from '../../types';
import { formatCurrency } from '../../utils/format';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  products: Product[];
  onSave: () => void;
  onClose: () => void;
}

export default function StockEntryForm({ products, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    product_id: '',
    quantity: '',
    cost_price: '',
    supplier_name: '',
    invoice_number: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const selectedProduct = products.find((p) => p.id === form.product_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id) return toast.error('Selecione um produto');
    if (!form.quantity || parseInt(form.quantity) <= 0) return toast.error('Quantidade inválida');

    setSaving(true);
    try {
      await stockApi.receiveStock({
        product_id: form.product_id,
        quantity: parseInt(form.quantity),
        cost_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
        supplier_name: form.supplier_name || undefined,
        invoice_number: form.invoice_number || undefined,
        notes: form.notes || undefined,
      });
      toast.success('Entrada registrada com sucesso');
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao registrar entrada');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Entrada de Mercadoria</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Produto *</label>
            <select
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="input w-full"
              required
            >
              <option value="">Selecione...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (estoque: {p.stock})</option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <span className="text-gray-500">Estoque atual: </span>
              <span className={`font-medium ${selectedProduct.stock <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                {selectedProduct.stock} {selectedProduct.unit}
              </span>
              {selectedProduct.cost_price && (
                <span className="ml-4 text-gray-500">
                  Custo: {formatCurrency(selectedProduct.cost_price)}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="input w-full"
                placeholder="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custo unitário</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                className="input w-full"
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
              <input
                type="text"
                value={form.supplier_name}
                onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                className="input w-full"
                placeholder="Nome do fornecedor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nota Fiscal</label>
              <input
                type="text"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                className="input w-full"
                placeholder="Nº da NF"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input w-full"
              rows={2}
              placeholder="Observações sobre a entrada..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Registrar Entrada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
