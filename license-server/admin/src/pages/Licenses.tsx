import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Ban, Unlock, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLicenseStore, License } from '../stores/licenseStore';
import CreateModal from '../components/licenses/CreateModal';
import RenewModal from '../components/licenses/RenewModal';

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  expired: 'Expirada',
  blocked: 'Bloqueada',
  pending: 'Pendente',
};

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
        <h1 className="text-2xl font-bold text-white">Licencas</h1>
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
          <p className="text-gray-400 text-center py-8">Carregando...</p>
        ) : licenses.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhuma licenca encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-3 font-medium">Chave</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Plano</th>
                  <th className="pb-3 font-medium">Maquinas</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Vencimento</th>
                  <th className="pb-3 font-medium text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((l) => (
                  <tr key={l.id} className="table-row">
                    <td className="py-3">
                      <button onClick={() => copyKey(l.license_key)} className="font-mono text-xs bg-gray-800 px-2 py-1 rounded hover:bg-gray-700 transition-colors" title="Copiar chave">
                        {l.license_key}
                      </button>
                    </td>
                    <td className="py-3">{l.client_name}</td>
                    <td className="py-3 text-gray-400">{l.plan_name}</td>
                    <td className="py-3 text-gray-400">{l.active_machines ?? 0}/{l.max_machines ?? 1}</td>
                    <td className="py-3">
                      <span className={`badge-${l.status}`}>{statusLabels[l.status] || l.status}</span>
                    </td>
                    <td className="py-3 text-gray-400">{new Date(l.expires_at).toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 text-right space-x-2">
                      <button onClick={() => navigate(`/licenses/${l.id}`)} className="text-gray-400 hover:text-blue-400" title="Detalhes">
                        <Eye size={16} />
                      </button>
                      {l.status === 'blocked' ? (
                        <button onClick={() => handleUnblock(l)} className="text-gray-400 hover:text-green-400" title="Desbloquear">
                          <Unlock size={16} />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => setRenewTarget(l)} className="text-gray-400 hover:text-green-400" title="Renovar">
                            <RefreshCw size={16} />
                          </button>
                          <button onClick={() => handleBlock(l)} className="text-gray-400 hover:text-red-400" title="Bloquear">
                            <Ban size={16} />
                          </button>
                        </>
                      )}
                      <button onClick={() => handleDelete(l)} className="text-gray-400 hover:text-red-400" title="Excluir">
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
