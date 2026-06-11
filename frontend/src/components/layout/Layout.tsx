import { Link, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useLicenseStore } from '../../stores/licenseStore';
import { useEffect, useRef } from 'react';
import PixConfirmationModal from '../pix/PixConfirmationModal';
import AgentRequestModal from '../pix/AgentRequestModal';

export default function Layout() {
  const { pixPending, dismissPix, agentRequest, dismissAgent, agentQueue, setAgentQueue } = useWebSocket();
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
        <main className="flex-1 p-4 xl:p-6 bg-gray-950 overflow-auto flex flex-col">
          <div className="w-full mx-auto" style={{ maxWidth: '1440px' }}>
            <Outlet />
          </div>
        </main>
      </div>
      {pixPending && (
        <PixConfirmationModal
          data={pixPending}
          onClose={dismissPix}
          onConfirmed={() => {}}
        />
      )}
      {agentQueue.length > 0 && (
        <AgentRequestModal
          requests={agentQueue}
          onClose={dismissAgent}
          onRequestsChange={setAgentQueue}
        />
      )}
    </div>
  );
}
