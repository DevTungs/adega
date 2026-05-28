import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Promotion } from '../../types';

interface Props {
  promotion?: Promotion | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export default function PromotionModal({ promotion, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'percentage',
    value: '',
    min_order_value: '',
    min_quantity: '',
    buy_quantity: '',
    get_quantity: '',
    start_date: '',
    end_date: '',
    max_uses: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (promotion) {
      setForm({
        name: promotion.name || '',
        description: promotion.description || '',
        type: promotion.type || 'percentage',
        value: promotion.value ? String(promotion.value) : '',
        min_order_value: promotion.min_order_value ? String(promotion.min_order_value) : '',
        min_quantity: promotion.min_quantity ? String(promotion.min_quantity) : '',
        buy_quantity: promotion.buy_quantity ? String(promotion.buy_quantity) : '',
        get_quantity: promotion.get_quantity ? String(promotion.get_quantity) : '',
        start_date: promotion.start_date ? promotion.start_date.slice(0, 10) : '',
        end_date: promotion.end_date ? promotion.end_date.slice(0, 10) : '',
        max_uses: promotion.max_uses ? String(promotion.max_uses) : '',
        is_active: promotion.is_active === 1,
      });
    }
  }, [promotion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start_date || !form.end_date) return;

    setSaving(true);
    try {
      await onSave({
        name: form.name,
        description: form.description || null,
        type: form.type,
        value: form.value ? parseFloat(form.value) : null,
        min_order_value: form.min_order_value ? parseFloat(form.min_order_value) : null,
        min_quantity: form.min_quantity ? parseInt(form.min_quantity) : null,
        buy_quantity: form.buy_quantity ? parseInt(form.buy_quantity) : null,
        get_quantity: form.get_quantity ? parseInt(form.get_quantity) : null,
        start_date: form.start_date,
        end_date: form.end_date,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        is_active: form.is_active ? 1 : 0,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{promotion ? 'Editar Promoção' : 'Nova Promoção'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input w-full" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input w-full">
                <option value="percentage">Porcentagem</option>
                <option value="fixed">Valor fixo</option>
                <option value="buy_x_get_y">Compre X Leve Y</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {form.type === 'buy_x_get_y' ? 'Compre (Qtd)' : 'Valor'}
              </label>
              {form.type === 'buy_x_get_y' ? (
                <input type="number" value={form.buy_quantity} onChange={(e) => setForm({ ...form, buy_quantity: e.target.value })} className="input w-full" />
              ) : (
                <input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input w-full" />
              )}
            </div>
          </div>

          {form.type === 'buy_x_get_y' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leve (Qtd)</label>
              <input type="number" value={form.get_quantity} onChange={(e) => setForm({ ...form, get_quantity: e.target.value })} className="input w-full" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pedido mín.</label>
              <input type="number" step="0.01" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qtd mín.</label>
              <input type="number" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data início *</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data fim *</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input w-full" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Limite de usos</label>
            <input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="input w-full" placeholder="Ilimitado" />
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            <span className="text-sm text-gray-700">Promoção ativa</span>
          </label>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : promotion ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
