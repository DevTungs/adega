import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Shield, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLicenseStore } from '../stores/licenseStore';

const statusLabels: Record<string, string> = {
  active: 'Ativa',
  expired: 'Vencida',
  blocked: 'Bloqueada',
  invalid: 'Inválida',
  pending: 'Pendente',
  tampered: 'Adulterada',
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

export default function License() {
  const { license, isLoading, fetchStatus, activate, validateNow } = useLicenseStore();
  const [licenseKey, setLicenseKey] = useState('');

  useEffect(() => {
    fetchStatus().catch(() => toast.error('Erro ao carregar licença'));
  }, [fetchStatus]);

  const handleActivate = async () => {
    try {
      await activate(licenseKey.trim());
      setLicenseKey('');
      toast.success('Licença ativada');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao ativar licença');
    }
  };

  const handleValidate = async () => {
    try {
      const result = await validateNow();
      if (result.lastError) {
        toast.error(result.lastError);
      } else {
        toast.success('Licença validada');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao validar licença');
    }
  };

  const isOk = license?.canCreateOrders;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Licença</h1>
        <button onClick={handleValidate} disabled={isLoading} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          Validar agora
        </button>
      </div>

      <div className={`card border ${isOk ? 'border-green-200' : 'border-red-200'}`}>
        <div className="flex items-start gap-4">
          {isOk ? (
            <CheckCircle className="text-green-600 mt-1" size={28} />
          ) : (
            <AlertCircle className="text-red-600 mt-1" size={28} />
          )}
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">
              {license ? statusLabels[license.status] : 'Carregando...'}
            </h2>
            <p className={isOk ? 'text-green-700 mt-1' : 'text-red-700 mt-1'}>
              {license?.message || 'Licença regular. Novos pedidos liberados.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <span className="block text-gray-400">Cliente</span>
            <strong>{license?.customerName || '-'}</strong>
          </div>
          <div>
            <span className="block text-gray-400">Vencimento</span>
            <strong>{formatDate(license?.expiresAt || null)}</strong>
          </div>
          <div>
            <span className="block text-gray-400">Última validação</span>
            <strong>{formatDate(license?.lastValidatedAt || null)}</strong>
          </div>
          <div>
            <span className="block text-gray-400">Permite novos pedidos</span>
            <strong>{license?.canCreateOrders ? 'Sim' : 'Não'}</strong>
          </div>
        </div>

        {license?.offline && (
          <div className="mt-4 rounded-lg bg-amber-900/30 p-3 text-sm text-amber-400 flex items-center gap-2">
            <AlertCircle size={16} />
            Servidor de licenças inacessível. Validação offline — o sistema funciona normalmente.
          </div>
        )}

        {license?.lastError && (
          <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            {license.lastError}
          </div>
        )}
      </div>

      {license?.offline && (
        <div className="card bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <WifiOff size={20} className="text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Modo offline — servidor de licenças indisponível</p>
              <p>
                O sistema está funcionando com a licença em cache. Todas as funcionalidades estão disponíveis.
                Quando o servidor voltar, a licença será revalidada automaticamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Offline info */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Sistema funciona offline</p>
            <p>
              A licença é validada localmente. Se o servidor de licenças ficar indisponível,
              o sistema continua funcionando normalmente. Apenas a expiração da licença ou
              bloqueio manual pelo administrador impedem novos pedidos.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={20} className="text-primary-600" />
          <h2 className="text-lg font-semibold">Ativar ou renovar licença</h2>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            className="input flex-1"
            placeholder="Digite a chave da licença"
          />
          <button
            onClick={handleActivate}
            disabled={isLoading || licenseKey.trim().length < 8}
            className="btn-primary"
          >
            Ativar licença
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-3">
          Quando a mensalidade vencer, o sistema bloqueia apenas novos pedidos. Consultas, configurações e reativação continuam disponíveis.
        </p>
      </div>
    </div>
  );
}
