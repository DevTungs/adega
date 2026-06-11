import { useAuthStore } from '../../stores/authStore';
import { Bell, LogOut, User } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuthStore();

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 xl:px-6 py-3 xl:py-4 flex items-center justify-between">
      <div>
        <h2 className="text-base xl:text-lg font-semibold text-white">Painel de Controle</h2>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-gray-400 hover:text-white">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600/20 rounded-full flex items-center justify-center">
            <User size={16} className="text-primary-400" />
          </div>
          <span className="text-sm font-medium text-gray-300">{user?.name || user?.username}</span>
        </div>
        <button
          onClick={logout}
          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
