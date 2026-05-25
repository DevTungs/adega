import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Ban, Unlock, Copy } from 'lucide-react';
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

export default function LicenseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentLicense, activationLogs, isLoading, fetchById, fetchLogs, renew, block, unblock } = useLicenseStore();

  useEffect(() => {
    if (id) {
      fetchById(id).catch(() => toast.error('Erro ao carregar licenca'));
      fetchLogs(id).catch(() => {});
    }
  }, [id, fetchById, fetchLogs]);

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
    return <div className="text-center text-gray-500 py-12">Carregando...</div>;
  }

  if (!currentLicense) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Licenca nao encontrada.</p>
        <button onClick={() => navigate('/licenses')} className="btn-secondary mt-4">Voltar</button>
      </div>
    );
  }

  const lic = currentLicense;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/licenses')} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Detalhes da Licenca</h1>
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
            <span className="text-sm text-gray-500">Chave</span>
            <div className="flex items-center gap-2 mt-1">
              <code className="bg-gray-100 px-3 py-1.5 rounded text-sm font-mono">{lic.license_key}</code>
              <button onClick={copyKey} className="text-gray-400 hover:text-gray-600"><Copy size={16} /></button>
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Status</span>
            <div className="mt-1">
              <span className={`badge-${lic.status} text-sm`}>{statusLabels[lic.status] || lic.status}</span>
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500">Cliente</span>
            <p className="font-medium mt-1">{lic.client_name}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Plano</span>
            <p className="font-medium mt-1">{lic.plan_name}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Vencimento</span>
            <p className="font-medium mt-1">{formatDate(lic.expires_at)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Ativada em</span>
            <p className="font-medium mt-1">{formatDate(lic.activated_at)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Ultima validacao</span>
            <p className="font-medium mt-1">{formatDate(lic.last_validated_at)}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Fingerprint da maquina</span>
            <p className="font-mono text-xs mt-1 bg-gray-50 p-2 rounded break-all">{lic.machine_fingerprint || 'Nenhum'}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Historico de Ativacoes</h2>
        {activationLogs.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma ativacao registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
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
                      <span className={log.action === 'activate' ? 'text-blue-600' : 'text-purple-600'}>
                        {log.action === 'activate' ? 'Ativacao' : log.action === 'validate' ? 'Validacao' : log.action}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={log.result === 'success' ? 'text-green-600' : 'text-red-600'}>
                        {log.result === 'success' ? 'Sucesso' : 'Falha'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">{log.message || '-'}</td>
                    <td className="py-3">
                      <span className="font-mono text-xs text-gray-400">{log.machine_fingerprint?.slice(0, 16)}...</span>
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
