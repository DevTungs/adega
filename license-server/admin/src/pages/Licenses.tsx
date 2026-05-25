import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Ban, Unlock, Eye, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLicenseStore, License } from '../stores/licenseStore';
import { useClientStore } from '../stores/clientStore';
import { usePlanStore } from '../stores/planStore';

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  expired: 'Expirada',
  blocked: 'Bloqueada',
  pending: 'Pendente',
};

function CreateModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => Promise<void> }) {
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">Nova Licenca</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
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

function RenewModal({ license, onClose, onSave }: { license: License; onClose: () => void; onSave: (expires_at: string) => Promise<void> }) {
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setExpiresAt(d.toISOString().slice(0, 10));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(expiresAt);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao renovar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">Renovar Licenca</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Chave: <code className="bg-gray-100 px-2 py-0.5 rounded">{license.license_key}</code></p>
          <div>
            <label className="label">Nova data de vencimento *</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="input" required />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Renovando...' : 'Renovar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Licenses() {
  const navigate = useNavigate();
  const { licenses, isLoading, fetchAll, create, renew, block, unblock, remove } = useLicenseStore();
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [renewTarget, setRenewTarget] = useState<License | null>(null);

  useEffect(() => {
    fetchAll(statusFilter ? { status: statusFilter } : undefined).catch(() => toast.error('Erro ao carregar licencas'));
  }, [fetchAll, statusFilter]);

  const handleBlock = async (lic: License) => {
    if (!confirm(`Bloquear licenca "${lic.license_key}"?`)) return;
    try {
      await block(lic.id);
      toast.success('Licenca bloqueada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao bloquear');
    }
  };

  const handleUnblock = async (lic: License) => {
    if (!confirm(`Desbloquear licenca "${lic.license_key}"?`)) return;
    try {
      await unblock(lic.id);
      toast.success('Licenca desbloqueada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbloquear');
    }
  };

  const handleDelete = async (lic: License) => {
    if (!confirm(`Excluir licenca "${lic.license_key}"? Esta acao nao pode ser desfeita.`)) return;
    try {
      await remove(lic.id);
      toast.success('Licenca excluida');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir');
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Chave copiada');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Licencas</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nova Licenca
        </button>
      </div>

      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select w-auto">
          <option value="">Todos os status</option>
          <option value="active">Ativas</option>
          <option value="expired">Expiradas</option>
          <option value="blocked">Bloqueadas</option>
          <option value="pending">Pendentes</option>
        </select>
      </div>

      <div className="card">
        {isLoading && licenses.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Carregando...</p>
        ) : licenses.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhuma licenca encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-3 font-medium">Chave</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Plano</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Vencimento</th>
                  <th className="pb-3 font-medium text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((l) => (
                  <tr key={l.id} className="table-row">
                    <td className="py-3">
                      <button onClick={() => copyKey(l.license_key)} className="font-mono text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 transition-colors" title="Copiar chave">
                        {l.license_key}
                      </button>
                    </td>
                    <td className="py-3">{l.client_name}</td>
                    <td className="py-3 text-gray-500">{l.plan_name}</td>
                    <td className="py-3">
                      <span className={`badge-${l.status}`}>{statusLabels[l.status] || l.status}</span>
                    </td>
                    <td className="py-3 text-gray-500">{new Date(l.expires_at).toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 text-right space-x-2">
                      <button onClick={() => navigate(`/licenses/${l.id}`)} className="text-gray-400 hover:text-blue-600" title="Detalhes">
                        <Eye size={16} />
                      </button>
                      {l.status === 'blocked' ? (
                        <button onClick={() => handleUnblock(l)} className="text-gray-400 hover:text-green-600" title="Desbloquear">
                          <Unlock size={16} />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => setRenewTarget(l)} className="text-gray-400 hover:text-green-600" title="Renovar">
                            <RefreshCw size={16} />
                          </button>
                          <button onClick={() => handleBlock(l)} className="text-gray-400 hover:text-red-600" title="Bloquear">
                            <Ban size={16} />
                          </button>
                        </>
                      )}
                      <button onClick={() => handleDelete(l)} className="text-gray-400 hover:text-red-600" title="Excluir">
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

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onSave={async (data) => {
            const lic = await create(data);
            toast.success(`Licenca criada: ${lic.license_key}`);
          }}
        />
      )}

      {renewTarget && (
        <RenewModal
          license={renewTarget}
          onClose={() => setRenewTarget(null)}
          onSave={async (expires_at) => {
            await renew(renewTarget.id, expires_at);
            toast.success('Licenca renovada');
          }}
        />
      )}
    </div>
  );
}
