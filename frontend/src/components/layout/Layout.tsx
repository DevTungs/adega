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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        {!license?.canCreateOrders && (
          <div className="bg-red-900/30 border-b border-red-800 px-6 py-3 text-sm text-red-400 flex items-center justify-between">
            <span>{license?.message || 'Ative a licença para liberar novos pedidos.'}</span>
            <Link to="/license" className="font-semibold underline">Regularizar licença</Link>
          </div>
        )}
        <main className="flex-1 p-6 bg-gray-950 overflow-auto flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
