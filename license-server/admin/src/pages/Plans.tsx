import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlanStore, Plan } from '../stores/planStore';
import PlanModal from '../components/plans/PlanModal';

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
        <h1 className="text-2xl font-bold text-white">Planos</h1>
        <button onClick={() => setModal({ mode: 'new' })} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Plano
        </button>
      </div>

      <div className="card">
        {isLoading && plans.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Carregando...</p>
        ) : plans.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhum plano cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-3 font-medium">Nome</th>
                  <th className="pb-3 font-medium">Descricao</th>
                  <th className="pb-3 font-medium">Duracao</th>
                  <th className="pb-3 font-medium">Graca</th>
                  <th className="pb-3 font-medium">Max. Maquinas</th>
                  <th className="pb-3 font-medium">Preco</th>
                  <th className="pb-3 font-medium text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 text-gray-400">{p.description || '-'}</td>
                    <td className="py-3">{p.duration_days} dias</td>
                    <td className="py-3">{p.grace_days ?? 3} dias</td>
                    <td className="py-3">{p.max_machines ?? 1}</td>
                    <td className="py-3">R$ {Number(p.price).toFixed(2)}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => setModal({ mode: 'edit', plan: p })} className="text-gray-400 hover:text-blue-400 mr-3">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(p)} className="text-gray-400 hover:text-red-400">
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
