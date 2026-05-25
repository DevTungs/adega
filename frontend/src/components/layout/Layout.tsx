import { Link, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useLicenseStore } from '../../stores/licenseStore';
import { useEffect } from 'react';

export default function Layout() {
  useWebSocket();
  const { license, fetchStatus } = useLicenseStore();

  useEffect(() => {
    fetchStatus().catch(() => undefined);
  }, [fetchStatus]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        {!license?.canCreateOrders && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-800 flex items-center justify-between">
            <span>{license?.message || 'Ative a licença para liberar novos pedidos.'}</span>
            <Link to="/license" className="font-semibold underline">Regularizar licença</Link>
          </div>
        )}
        <main className="flex-1 p-6 bg-gray-50 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
