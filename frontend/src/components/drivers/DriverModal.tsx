import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DeliveryDriver } from '../../types';

interface Props {
  driver?: DeliveryDriver | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export default function DriverModal({ driver, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    vehicle: '',
    plate: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (driver) {
      setForm({
        name: driver.name || '',
        phone: driver.phone || '',
        vehicle: driver.vehicle || '',
        plate: '',
        is_active: driver.is_active === 1,
      });
    }
  }, [driver]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;

    setSaving(true);
    try {
      await onSave({
        name: form.name,
        phone: form.phone,
        vehicle: form.vehicle || null,
        plate: form.plate || null,
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
          <h2 className="text-lg font-semibold">{driver ? 'Editar Motorista' : 'Novo Motorista'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input w-full" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Veículo</label>
              <input type="text" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} className="input w-full" placeholder="Moto, Carro..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Placa</label>
              <input type="text" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} className="input w-full" />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            <span className="text-sm text-gray-700">Motorista ativo</span>
          </label>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : driver ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
