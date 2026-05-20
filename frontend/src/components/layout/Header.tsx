import { useAuthStore } from '../../stores/authStore';
import { Bell, LogOut, User } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuthStore();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Painel de Controle</h2>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-500 hover:text-gray-700">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <User size={16} className="text-primary-600" />
          </div>
          <span className="text-sm font-medium text-gray-700">{user?.name || user?.username}</span>
        </div>
        <button
          onClick={logout}
          className="p-2 text-gray-500 hover:text-red-600 transition-colors"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
