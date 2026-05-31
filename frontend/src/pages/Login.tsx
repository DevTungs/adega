import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'Netrix System - Login';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      setAuth(data.data.token, data.data.user);
      toast.success('Login realizado!');
      window.location.href = '/';
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Credenciais invalidas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center">
        {/* Logo */}
        <div className="mb-8 animate-fade-in">
          <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl shadow-primary-500/30">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent mb-2 animate-slide-up">
          NETRIX SYSTEM
        </h1>
        <p className="text-gray-400 mb-8 animate-slide-up-delay">Painel Administrativo</p>

        {/* Form */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 w-full max-w-md animate-fade-in-delay">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Usuario</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="admin"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="*****"
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 mt-6"
            >
              {saving ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
        .animate-slide-up { opacity: 0; animation: slide-up 0.8s ease-out 0.3s forwards; }
        .animate-slide-up-delay { opacity: 0; animation: slide-up 0.8s ease-out 0.6s forwards; }
        .animate-fade-in-delay { opacity: 0; animation: fade-in 0.8s ease-out 0.9s forwards; }
      `}</style>
    </div>
  );
}
