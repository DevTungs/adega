import { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  onRetry: () => Promise<void>;
}

export default function LicenseServerDownModal({ onRetry }: Props) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 rounded-full bg-amber-900/40 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="text-amber-400" size={32} />
        </div>

        <h2 className="text-xl font-bold text-white mb-3">
          Servidor de Licenças em Manutenção
        </h2>

        <p className="text-gray-400 text-sm leading-relaxed mb-6">
          Não foi possível conectar ao servidor de licenças. O sistema pode estar
          em manutenção ou temporariamente indisponível.
        </p>

        <button
          onClick={handleRetry}
          disabled={retrying}
          className="btn-primary flex items-center justify-center gap-2 w-full"
        >
          <RefreshCw size={18} className={retrying ? 'animate-spin' : ''} />
          {retrying ? 'Verificando...' : 'Tentar novamente'}
        </button>

        <p className="text-gray-500 text-xs mt-4">
          Se o problema persistir, entre em contato com o suporte técnico.
        </p>
      </div>
    </div>
  );
}
