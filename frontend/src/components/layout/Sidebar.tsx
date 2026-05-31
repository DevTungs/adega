import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users as UsersIcon,
  MessageCircle,
  MessageSquare,
  Settings,
  Shield,
  BarChart3,
  Truck,
  Monitor,
  Bike,
  UserCog,
} from 'lucide-react';
import api from '../../api/client';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pdv', icon: Monitor, label: 'PDV' },
  { to: '/delivery-orders', icon: Bike, label: 'Pedidos Delivery' },
  { to: '/balcao-orders', icon: ShoppingBag, label: 'Pedidos Balcão' },
  { to: '/products', icon: Package, label: 'Produtos' },
  { to: '/customers', icon: UsersIcon, label: 'Clientes' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/suppliers', icon: Truck, label: 'Fornecedores' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { to: '/messages', icon: MessageSquare, label: 'Mensagens' },
  { to: '/users', icon: UserCog, label: 'Usuarios' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
  { to: '/license', icon: Shield, label: 'Licença' },
];

export default function Sidebar() {
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    api.get('/settings/store_name').then(({ data }) => {
      if (data.data) {
        setStoreName(data.data);
        document.title = `${data.data} - Painel Administrativo`;
      }
    }).catch(() => {});
  }, []);

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{storeName || 'Painel'}</h1>
            <p className="text-sm text-gray-400 mt-0.5">Painel Administrativo</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800 text-sm text-gray-500">
        v1.0.0
      </div>
    </aside>
  );
}
