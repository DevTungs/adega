import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrderStore } from '../stores/orderStore';
import { ordersApi } from '../api/orders';
import StatsCards from '../components/dashboard/StatsCards';
import { DashboardStats } from '../types';
import { formatCurrency, formatDateTime, STATUS_LABELS, STATUS_COLORS } from '../utils/format';
import { BarChart3 } from 'lucide-react';

export default function Dashboard() {
  const { orders, fetchOrders } = useOrderStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetchOrders({ limit: 10 });
    ordersApi.getStats().then(({ data }) => setStats(data.data)).catch(() => {});
  }, [fetchOrders]);

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link to="/reports" className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm">
          <BarChart3 size={18} />
          Ver Relatórios
        </Link>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Pedidos Recentes</h3>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium text-primary-600">#{order.order_number}</span>
                  <span className="ml-2 text-gray-700">{order.customer_name || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{formatCurrency(order.total)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <p className="text-gray-500 text-center py-4">Nenhum pedido recente</p>
            )}
          </div>
        </div>

        {/* Status Summary */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Pedidos por Status</h3>
          <div className="space-y-3">
            {stats?.byStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[item.status] || 'bg-gray-100'}`}>
                  {STATUS_LABELS[item.status] || item.status}
                </span>
                <span className="text-2xl font-bold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
