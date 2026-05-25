import { useEffect } from 'react';
import { Users, Key, CheckCircle, XCircle, Ban, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDashboardStore } from '../stores/dashboardStore';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

export default function Dashboard() {
  const { stats, isLoading, fetchStats } = useDashboardStore();

  useEffect(() => {
    fetchStats().catch(() => toast.error('Erro ao carregar estatisticas'));
  }, [fetchStats]);

  if (isLoading && !stats) {
    return <div className="text-center text-gray-500 py-12">Carregando...</div>;
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Clientes" value={stats.totalClients} icon={Users} color="bg-blue-500" />
        <StatCard label="Licencas Ativas" value={stats.activeLicenses} icon={CheckCircle} color="bg-green-500" />
        <StatCard label="Expiradas" value={stats.expiredLicenses} icon={XCircle} color="bg-red-500" />
        <StatCard label="Bloqueadas" value={stats.blockedLicenses} icon={Ban} color="bg-gray-500" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Pendentes" value={stats.pendingLicenses} icon={Clock} color="bg-yellow-500" />
        <StatCard label="Total de Licencas" value={stats.totalLicenses} icon={Key} color="bg-primary-500" />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ativacoes Recentes</h2>
        {stats.recentActivations.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma ativacao registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-3 font-medium">Data</th>
                  <th className="pb-3 font-medium">Cliente</th>
                  <th className="pb-3 font-medium">Acao</th>
                  <th className="pb-3 font-medium">Resultado</th>
                  <th className="pb-3 font-medium">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentActivations.map((a) => (
                  <tr key={a.id} className="table-row">
                    <td className="py-3">{formatDate(a.created_at)}</td>
                    <td className="py-3">{a.client_name || '-'}</td>
                    <td className="py-3">
                      <span className={a.action === 'activate' ? 'text-blue-600' : 'text-purple-600'}>
                        {a.action === 'activate' ? 'Ativacao' : 'Validacao'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={a.result === 'success' ? 'text-green-600' : 'text-red-600'}>
                        {a.result === 'success' ? 'Sucesso' : 'Falha'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">{a.message || '-'}</td>
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
