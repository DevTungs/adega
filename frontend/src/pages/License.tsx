import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Shield } from 'lucide-react';
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
      await validateNow();
      toast.success('Licença validada');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao validar licença');
    }
  };

  const isOk = license?.canCreateOrders;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Licença</h1>
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
            <h2 className="text-lg font-semibold text-gray-900">
              {license ? statusLabels[license.status] : 'Carregando...'}
            </h2>
            <p className={isOk ? 'text-green-700 mt-1' : 'text-red-700 mt-1'}>
              {license?.message || 'Licença regular. Novos pedidos liberados.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <span className="block text-gray-500">Cliente</span>
            <strong>{license?.customerName || '-'}</strong>
          </div>
          <div>
            <span className="block text-gray-500">Vencimento</span>
            <strong>{formatDate(license?.expiresAt || null)}</strong>
          </div>
          <div>
            <span className="block text-gray-500">Última validação</span>
            <strong>{formatDate(license?.lastValidatedAt || null)}</strong>
          </div>
          <div>
            <span className="block text-gray-500">Permite novos pedidos</span>
            <strong>{license?.canCreateOrders ? 'Sim' : 'Não'}</strong>
          </div>
        </div>

        {license?.lastError && (
          <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            {license.lastError}
          </div>
        )}
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
        <p className="text-sm text-gray-500 mt-3">
          Quando a mensalidade vencer, o sistema bloqueia apenas novos pedidos. Consultas, configurações e reativação continuam disponíveis.
        </p>
      </div>
    </div>
  );
}
