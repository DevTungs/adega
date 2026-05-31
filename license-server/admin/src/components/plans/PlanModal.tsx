import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Plan } from '../../stores/planStore';

export default function PlanModal({ plan, onClose, onSave }: { plan?: Plan | null; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [name, setName] = useState(plan?.name || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [durationDays, setDurationDays] = useState(String(plan?.duration_days || 30));
  const [graceDays, setGraceDays] = useState(String(plan?.grace_days ?? 3));
  const [price, setPrice] = useState(String(plan?.price || 0));
  const [maxMachines, setMaxMachines] = useState(String(plan?.max_machines ?? 1));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        description: description || undefined,
        duration_days: parseInt(durationDays),
        grace_days: parseInt(graceDays),
        price: parseFloat(price),
        max_machines: parseInt(maxMachines) || 1,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">{plan ? 'Editar Plano' : 'Novo Plano'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Descricao</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Duracao (dias) *</label>
              <input type="number" min="1" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Graca (dias)</label>
              <input type="number" min="0" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Preco (R$) *</label>
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Max. Maquinas</label>
              <input type="number" min="1" value={maxMachines} onChange={(e) => setMaxMachines(e.target.value)} className="input" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
