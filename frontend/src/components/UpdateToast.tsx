import { useEffect } from 'react';
import toast from 'react-hot-toast';

declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>;
      onUpdateAvailable: (cb: (_: any, data: any) => void) => void;
      onUpdateDownloadProgress: (cb: (_: any, data: any) => void) => void;
      onUpdateDownloaded: (cb: (_: any, data: any) => void) => void;
      installUpdate: () => void;
    };
  }
}

export default function UpdateToast() {
  const api = window.electronAPI;
  if (!api) return null;

  useEffect(() => {
    let progressToastId: string | null = null;

    api.onUpdateAvailable((_, data) => {
      toast(`Atualizacao v${data.version} disponivel, baixando...`, {
        icon: '\u{1F4E5}',
        duration: 4000,
      });
    });

    api.onUpdateDownloadProgress((_, data) => {
      if (!progressToastId) {
        progressToastId = toast.custom(
          (t) => (
            <div
              className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-white shadow-lg rounded-lg p-4 border border-gray-200 min-w-[280px]`}
            >
              <p className="text-sm font-medium text-gray-700 mb-2">
                Baixando atualizacao...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${data.percent}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{data.percent}%</p>
            </div>
          ),
          { duration: Infinity, id: 'update-progress' }
        );
      } else {
        // Update the progress via re-rendering the custom toast
        toast.custom(
          (t) => (
            <div
              className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-white shadow-lg rounded-lg p-4 border border-gray-200 min-w-[280px]`}
            >
              <p className="text-sm font-medium text-gray-700 mb-2">
                Baixando atualizacao...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${data.percent}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{data.percent}%</p>
            </div>
          ),
          { duration: Infinity, id: 'update-progress' }
        );
      }
    });

    api.onUpdateDownloaded((_, data) => {
      // Dismiss progress toast
      toast.dismiss('update-progress');
      progressToastId = null;

      toast.custom(
        (t) => (
          <div
            className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-white shadow-lg rounded-lg p-4 border border-green-200 min-w-[300px]`}
          >
            <p className="text-sm font-medium text-gray-700 mb-1">
              Atualizacao v{data.version} pronta!
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Reinicie para aplicar.
            </p>
            <button
              onClick={() => {
                toast.dismiss('update-ready');
                api.installUpdate();
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
            >
              Reiniciar agora
            </button>
          </div>
        ),
        { duration: Infinity, id: 'update-ready' }
      );
    });
  }, []);

  return null;
}
