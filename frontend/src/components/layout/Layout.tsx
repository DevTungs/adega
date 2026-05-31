import { Link, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useLicenseStore } from '../../stores/licenseStore';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export default function Layout() {
  useWebSocket();
  const { license, fetchStatus } = useLicenseStore();
  const offlineToastShown = useRef(false);

  useEffect(() => {
    fetchStatus().catch(() => undefined);
  }, [fetchStatus]);

  // Show toast when server goes offline (once per session)
  useEffect(() => {
    if (license?.offline && !offlineToastShown.current) {
      offlineToastShown.current = true;
      toast.error('Servidor de licenças indisponível. Sistema em modo offline.', { duration: 6000 });
    }
    if (!license?.offline) {
      offlineToastShown.current = false;
    }
  }, [license?.offline]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        {license?.offline && (
          <div className="bg-amber-900/30 border-b border-amber-800 px-6 py-3 text-sm text-amber-400 flex items-center justify-between">
            <span>Servidor de licenças inacessível. O sistema funciona normalmente, mas não foi possível validar a licença online.</span>
            <Link to="/license" className="font-semibold underline">Ver licença</Link>
          </div>
        )}
        {!license?.canCreateOrders && (
          <div className="bg-red-900/30 border-b border-red-800 px-6 py-3 text-sm text-red-400 flex items-center justify-between">
            <span>{license?.message || 'Ative a licença para liberar novos pedidos.'}</span>
            <Link to="/license" className="font-semibold underline">Regularizar licença</Link>
          </div>
        )}
        <main className="flex-1 p-6 bg-gray-950 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
