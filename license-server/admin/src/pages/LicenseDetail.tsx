import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Ban, Unlock, Copy, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLicenseStore } from '../stores/licenseStore';

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  expired: 'Expirada',
  blocked: 'Bloqueada',
  pending: 'Pendente',
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

interface Machine {
  id: string;
  machine_fingerprint: string;
  machine_name: string | null;
  activated_at: string;
  last_seen_at: string | null;
  is_active: number;
}

export default function LicenseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentLicense, activationLogs, isLoading, fetchById, fetchLogs, renew, block, unblock } = useLicenseStore();
  const [machines, setMachines] = useState<Machine[]>([]);

  useEffect(() => {
    if (id) {
      fetchById(id).catch(() => toast.error('Erro ao carregar licenca'));
      fetchLogs(id).catch(() => {});
      fetchMachines(id);
    }
  }, [id, fetchById, fetchLogs]);

  const fetchMachines = async (licenseId: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/licenses/${licenseId}/machines`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setMachines(data.data);
    } catch {}
  };

  const handleDeactivateMachine = async (fingerprint: string) => {
    if (!id || !confirm('Desativar esta maquina?')) return;
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/licenses/${id}/machines/${encodeURIComponent(fingerprint)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Maquina desativada');
        fetchMachines(id);
      } else {
        toast.error(data.message || 'Erro ao desativar');
      }
    } catch {
      toast.error('Erro ao desativar maquina');
    }
  };

  const copyKey = () => {
    if (currentLicense) {
      navigator.clipboard.writeText(currentLicense.license_key);
      toast.success('Chave copiada');
    }
  };

  const handleRenew = async () => {
    if (!currentLicense) return;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const newDate = prompt('Nova data de vencimento (YYYY-MM-DD):', d.toISOString().slice(0, 10));
    if (!newDate) return;
    try {
      await renew(currentLicense.id, newDate);
      toast.success('Licenca renovada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao renovar');
    }
  };

  const handleBlock = async () => {
    if (!currentLicense) return;
    if (!confirm('Bloquear esta licenca?')) return;
    try {
      await block(currentLicense.id);
      toast.success('Licenca bloqueada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao bloquear');
    }
  };

  const handleUnblock = async () => {
    if (!currentLicense) return;
    if (!confirm('Desbloquear esta licenca?')) return;
    try {
      await unblock(currentLicense.id);
      toast.success('Licenca desbloqueada');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbloquear');
    }
  };

  if (isLoading && !currentLicense) {
    return <div className="text-center text-gray-400 py-12">Carregando...</div>;
  }

  if (!currentLicense) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Licenca nao encontrada.</p>
        <button onClick={() => navigate('/licenses')} className="btn-secondary mt-4">Voltar</button>
      </div>
    );
  }

  const lic = currentLicense;
  const activeMachines = machines.filter((m) => m.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/licenses')} className="text-gray-400 hover:text-white">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-white">Detalhes da Licenca</h1>
        </div>
        {lic.status === 'blocked' ? (
          <div className="flex gap-3">
            <button onClick={handleUnblock} className="btn-primary flex items-center gap-2">
              <Unlock size={16} /> Desbloquear
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={handleRenew} className="btn-secondary flex items-center gap-2">
              <RefreshCw size={16} /> Renovar
            </button>
            <button onClick={handleBlock} className="btn-danger flex items-center gap-2">
              <Ban size={16} /> Bloquear
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <span className="text-sm text-gray-400">Chave</span>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-gray-800 px-3 py-1.5 rounded text-sm font-mono">{lic.license_key}</code>
              <button onClick={copyKey} className="text-gray-400 hover:text-white"><Copy size={16} /></button>
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-400">Status</span>
            <div className="mt-1">
              <span className={`badge-${lic.status} text-sm`}>{statusLabels[lic.status] || lic.status}</span>
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-400">Cliente</span>
            <p className="font-medium mt-1">{lic.client_name}</p>
          </div>
          <div>
            <span className="text-sm text-gray-400">Plano</span>
            <p className="font-medium mt-1">{lic.plan_name}</p>
          </div>
          <div>
            <span className="text-sm text-gray-400">Vencimento</span>
            <p className="font-medium mt-1">{formatDate(lic.expires_at)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-400">Ativada em</span>
            <p className="font-medium mt-1">{formatDate(lic.activated_at)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-400">Ultima validacao</span>
            <p className="font-medium mt-1">{formatDate(lic.last_validated_at)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-400">Maquinas</span>
            <p className="font-medium mt-1">{activeMachines} / {lic.max_machines ?? 1} utilizadas</p>
          </div>
        </div>
      </div>

      {/* Machines */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Maquinas Ativadas</h2>
        {machines.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhuma maquina ativada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-3 font-medium">Fingerprint</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Ativada em</th>
                  <th className="pb-3 font-medium">Ultimo acesso</th>
                  <th className="pb-3 font-medium text-right">Acao</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id} className="table-row">
                    <td className="py-3">
                      <span className="font-mono text-xs text-gray-400">{m.machine_fingerprint.slice(0, 24)}...</span>
                    </td>
                    <td className="py-3">
                      <span className={m.is_active ? 'text-green-400' : 'text-gray-500'}>
                        {m.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400">{formatDate(m.activated_at)}</td>
                    <td className="py-3 text-gray-400">{formatDate(m.last_seen_at)}</td>
                    <td className="py-3 text-right">
                      {m.is_active ? (
                        <button
                          onClick={() => handleDeactivateMachine(m.machine_fingerprint)}
                          className="text-gray-400 hover:text-red-400"
                          title="Desativar maquina"
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activation log */}
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Historico de Ativacoes</h2>
        {activationLogs.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhuma ativacao registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-3 font-medium">Data</th>
                  <th className="pb-3 font-medium">Acao</th>
                  <th className="pb-3 font-medium">Resultado</th>
                  <th className="pb-3 font-medium">Mensagem</th>
                  <th className="pb-3 font-medium">Fingerprint</th>
                </tr>
              </thead>
              <tbody>
                {activationLogs.map((log) => (
                  <tr key={log.id} className="table-row">
                    <td className="py-3">{formatDate(log.created_at)}</td>
                    <td className="py-3">
                      <span className={log.action === 'activate' ? 'text-blue-400' : 'text-purple-400'}>
                        {log.action === 'activate' ? 'Ativacao' : log.action === 'validate' ? 'Validacao' : log.action}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={log.result === 'success' ? 'text-green-400' : 'text-red-400'}>
                        {log.result === 'success' ? 'Sucesso' : 'Falha'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400">{log.message || '-'}</td>
                    <td className="py-3">
                      <span className="font-mono text-xs text-gray-500">{log.machine_fingerprint?.slice(0, 16)}...</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
