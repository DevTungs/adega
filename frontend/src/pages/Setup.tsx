import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useAuthStore } from '../stores/authStore';

export default function Setup() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [phase, setPhase] = useState<'welcome' | 'register'>('welcome');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('As senhas nao coincidem');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post('/setup/register', { username, password, name });
      setAuth(data.data.token, data.data.user);
      toast.success('Conta criada com sucesso!');
      // Force full reload so App.tsx re-checks setup status
      window.location.href = '/';
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setSaving(false);
    }
  };

  if (phase === 'welcome') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 overflow-hidden">
        <div className="text-center">
          {/* Logo / Icon */}
          <div className="mb-8 animate-fade-in">
            <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl shadow-primary-500/30">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 animate-slide-up">
            BEM VINDO AO
          </h1>
          <h2 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent mb-6 animate-slide-up-delay">
            NETRIX SYSTEM
          </h2>

          {/* Subtitle */}
          <p className="text-gray-400 text-lg mb-12 animate-fade-in-delay max-w-md mx-auto">
            Sistema de gestao completo para o seu negocio
          </p>

          {/* CTA */}
          <button
            onClick={() => setPhase('register')}
            className="btn-primary text-lg px-10 py-4 animate-bounce-in"
          >
            Vamos comecar
          </button>
        </div>

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes bounce-in {
            0% { opacity: 0; transform: scale(0.8); }
            60% { transform: scale(1.05); }
            100% { opacity: 1; transform: scale(1); }
          }
          .animate-fade-in {
            animation: fade-in 0.8s ease-out forwards;
          }
          .animate-slide-up {
            opacity: 0;
            animation: slide-up 0.8s ease-out 0.3s forwards;
          }
          .animate-slide-up-delay {
            opacity: 0;
            animation: slide-up 0.8s ease-out 0.6s forwards;
          }
          .animate-fade-in-delay {
            opacity: 0;
            animation: fade-in 0.8s ease-out 0.9s forwards;
          }
          .animate-bounce-in {
            opacity: 0;
            animation: bounce-in 0.6s ease-out 1.2s forwards;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mb-4 shadow-lg shadow-primary-500/20">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Criar primeiro acesso</h1>
          <p className="text-gray-400 mt-2">Configure sua conta de administrador</p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Seu nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ex: Joao da Silva"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Usuario</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ex: admin"
                required
                minLength={3}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Minimo 6 caracteres"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-1 block">Confirmar senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Repita a senha"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 mt-6"
            >
              {saving ? 'Criando conta...' : 'Criar conta e entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
