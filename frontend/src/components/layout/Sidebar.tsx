import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FolderOpen,
  Users,
  MessageCircle,
  MessageSquare,
  Settings,
  Shield,
} from 'lucide-react';
import api from '../../api/client';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders', icon: ShoppingBag, label: 'Pedidos' },
  { to: '/products', icon: Package, label: 'Produtos' },
  { to: '/categories', icon: FolderOpen, label: 'Categorias' },
  { to: '/customers', icon: Users, label: 'Clientes' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { to: '/messages', icon: MessageSquare, label: 'Mensagens' },
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
        <h1 className="text-xl font-bold">{storeName || 'Painel'}</h1>
        <p className="text-sm text-gray-400 mt-1">Painel Administrativo</p>
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
