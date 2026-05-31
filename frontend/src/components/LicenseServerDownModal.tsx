import { useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface Props {
  onRetry: () => Promise<void>;
  onDismiss: () => void;
}

export default function LicenseServerDownModal({ onRetry, onDismiss }: Props) {
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
    <div className="fixed top-4 right-4 z-[9999] max-w-sm w-full animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-gray-900 border border-amber-700/50 rounded-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-900/40 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="text-amber-400" size={20} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-white">
                Servidor de Licenças Indisponível
              </h3>
              <button
                onClick={onDismiss}
                className="text-gray-500 hover:text-gray-300 transition-colors ml-2"
                title="Dispensar"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-gray-400 text-xs leading-relaxed mb-3">
              O sistema continua funcionando normalmente. Algumas funcionalidades podem estar temporariamente limitadas.
            </p>

            <button
              onClick={handleRetry}
              disabled={retrying}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
              {retrying ? 'Verificando...' : 'Tentar reconectar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
