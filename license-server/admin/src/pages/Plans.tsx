import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlanStore, Plan } from '../stores/planStore';

function PlanModal({ plan, onClose, onSave }: { plan?: Plan | null; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [name, setName] = useState(plan?.name || '');
  const [description, setDescription] = useState(plan?.description || '');
  const [durationDays, setDurationDays] = useState(String(plan?.duration_days || 30));
  const [graceDays, setGraceDays] = useState(String(plan?.grace_days ?? 3));
  const [price, setPrice] = useState(String(plan?.price || 0));
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">{plan ? 'Editar Plano' : 'Novo Plano'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
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
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Duracao (dias) *</label>
              <input type="number" min="1" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Graça (dias)</label>
              <input type="number" min="0" value={graceDays} onChange={(e) => setGraceDays(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Preco (R$) *</label>
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" required />
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

export default function Plans() {
  const { plans, isLoading, fetchAll, create, update, remove } = usePlanStore();
  const [modal, setModal] = useState<{ mode: 'new' | 'edit'; plan?: Plan } | null>(null);

  useEffect(() => {
    fetchAll().catch(() => toast.error('Erro ao carregar planos'));
  }, [fetchAll]);

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Excluir plano "${plan.name}"?`)) return;
    try {
      await remove(plan.id);
      toast.success('Plano excluido');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Planos</h1>
        <button onClick={() => setModal({ mode: 'new' })} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Plano
        </button>
      </div>

      <div className="card">
        {isLoading && plans.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Carregando...</p>
        ) : plans.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum plano cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-3 font-medium">Nome</th>
                  <th className="pb-3 font-medium">Descricao</th>
                  <th className="pb-3 font-medium">Duracao</th>
                  <th className="pb-3 font-medium">Graca</th>
                  <th className="pb-3 font-medium">Preco</th>
                  <th className="pb-3 font-medium text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 text-gray-500">{p.description || '-'}</td>
                    <td className="py-3">{p.duration_days} dias</td>
                    <td className="py-3">{p.grace_days ?? 3} dias</td>
                    <td className="py-3">R$ {Number(p.price).toFixed(2)}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => setModal({ mode: 'edit', plan: p })} className="text-gray-400 hover:text-blue-600 mr-3">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(p)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <PlanModal
          plan={modal.mode === 'edit' ? modal.plan : null}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            if (modal.mode === 'edit' && modal.plan) {
              await update(modal.plan.id, data);
              toast.success('Plano atualizado');
            } else {
              await create(data);
              toast.success('Plano criado');
            }
          }}
        />
      )}
    </div>
  );
}
