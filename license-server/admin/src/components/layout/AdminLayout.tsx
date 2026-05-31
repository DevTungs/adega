import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../stores/authStore';

export default function AdminLayout() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const admin = useAuthStore((s) => s.admin);

  useEffect(() => {
    if (!admin) fetchMe();
  }, [admin, fetchMe]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Netrix</h2>
        </header>
        <main className="flex-1 p-6 bg-gray-950 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
