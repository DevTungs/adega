import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClientStore } from '../../stores/clientStore';
import { usePlanStore } from '../../stores/planStore';

export default function CreateModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const { clients, fetchAll: fetchClients } = useClientStore();
  const { plans, fetchAll: fetchPlans } = usePlanStore();
  const [clientId, setClientId] = useState('');
  const [planId, setPlanId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClients().catch(() => {});
    fetchPlans().catch(() => {});
  }, [fetchClients, fetchPlans]);

  useEffect(() => {
    if (planId && plans.length > 0) {
      const plan = plans.find((p) => p.id === planId);
      if (plan) {
        const d = new Date();
        d.setDate(d.getDate() + plan.duration_days);
        setExpiresAt(d.toISOString().slice(0, 10));
      }
    }
  }, [planId, plans]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ client_id: clientId, plan_id: planId, expires_at: expiresAt });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar licenca');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Nova Licenca</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Cliente *</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="select" required>
              <option value="">Selecione...</option>
              {clients.filter((c) => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Plano *</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="select" required>
              <option value="">Selecione...</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name} - {p.duration_days} dias - R$ {Number(p.price).toFixed(2)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Data de vencimento *</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="input" required />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Criando...' : 'Criar Licenca'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
