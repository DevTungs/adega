import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Coupon } from '../../types';

interface Props {
  coupon?: Coupon | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export default function CouponModal({ coupon, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    code: '',
    description: '',
    type: 'percentage',
    value: '',
    min_order_value: '',
    max_discount: '',
    max_uses: '',
    per_customer: '1',
    start_date: '',
    end_date: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (coupon) {
      setForm({
        code: coupon.code || '',
        description: coupon.description || '',
        type: coupon.type || 'percentage',
        value: String(coupon.value || ''),
        min_order_value: coupon.min_order_value ? String(coupon.min_order_value) : '',
        max_discount: coupon.max_discount ? String(coupon.max_discount) : '',
        max_uses: coupon.max_uses ? String(coupon.max_uses) : '',
        per_customer: String(coupon.per_customer ?? 1),
        start_date: coupon.start_date ? coupon.start_date.slice(0, 10) : '',
        end_date: coupon.end_date ? coupon.end_date.slice(0, 10) : '',
        is_active: coupon.is_active === 1,
      });
    }
  }, [coupon]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.value || !form.start_date || !form.end_date) return;

    setSaving(true);
    try {
      await onSave({
        code: form.code,
        description: form.description || null,
        type: form.type,
        value: parseFloat(form.value),
        min_order_value: form.min_order_value ? parseFloat(form.min_order_value) : null,
        max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        per_customer: parseInt(form.per_customer) || 1,
        start_date: form.start_date,
        end_date: form.end_date,
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
          <h2 className="text-lg font-semibold">{coupon ? 'Editar Cupom' : 'Novo Cupom'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input w-full">
                <option value="percentage">Porcentagem</option>
                <option value="fixed">Valor fixo</option>
                <option value="free_delivery">Frete grátis</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input w-full" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
              <input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pedido mín.</label>
              <input type="number" step="0.01" value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: e.target.value })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desconto máx.</label>
              <input type="number" step="0.01" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Limite de usos</label>
              <input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="input w-full" placeholder="Ilimitado" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Por cliente</label>
              <input type="number" value={form.per_customer} onChange={(e) => setForm({ ...form, per_customer: e.target.value })} className="input w-full" />
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

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            <span className="text-sm text-gray-700">Cupom ativo</span>
          </label>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : coupon ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
