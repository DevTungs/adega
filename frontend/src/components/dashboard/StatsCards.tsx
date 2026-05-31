import { DashboardStats } from '../../types';
import { formatCurrency } from '../../utils/format';
import { ShoppingBag, DollarSign, TrendingUp, Clock } from 'lucide-react';

interface Props {
  stats: DashboardStats | null;
}

export default function StatsCards({ stats }: Props) {
  if (!stats) return null;

  const pendingCount = stats.byStatus.find((s) => s.status === 'pending')?.count || 0;
  const preparingCount = stats.byStatus.find((s) => s.status === 'preparing')?.count || 0;

  const cards = [
    {
      label: 'Total de Pedidos',
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: 'bg-blue-500',
    },
    {
      label: 'Receita Total',
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: 'bg-green-500',
    },
    {
      label: 'Ticket Médio',
      value: formatCurrency(stats.avgOrder),
      icon: TrendingUp,
      color: 'bg-purple-500',
    },
    {
      label: 'Pendentes / Preparando',
      value: `${pendingCount} / ${preparingCount}`,
      icon: Clock,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="card flex items-center gap-4">
          <div className={`${card.color} p-3 rounded-xl text-white`}>
            <card.icon size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-xl font-bold text-white">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
