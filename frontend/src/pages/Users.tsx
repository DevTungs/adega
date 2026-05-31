import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, Users as UsersIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  is_active: number;
  created_at: string;
}

function UserModal({ user, onClose, onSave }: { user?: User | null; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [username, setUsername] = useState(user?.username || '');
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(user?.role || 'admin');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data: any = { name, role };
      if (!user) {
        data.username = username;
        data.password = password;
      } else if (password) {
        data.password = password;
      }
      await onSave(data);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">{user ? 'Editar Usuario' : 'Novo Usuario'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-400"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {!user && (
            <div>
              <label className="label">Usuario *</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className="input" required minLength={3} />
            </div>
          )}
          <div>
            <label className="label">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">{user ? 'Nova senha (deixe vazio para manter)' : 'Senha *'}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" minLength={user ? 0 : 6} required={!user} />
          </div>
          <div>
            <label className="label">Funcao</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
              <option value="admin">Administrador</option>
              <option value="operator">Operador</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'new' | 'edit'; user?: User } | null>(null);

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data.data);
    } catch {
      toast.error('Erro ao carregar usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSave = async (userData: any) => {
    if (modal?.mode === 'edit' && modal.user) {
      await api.put(`/users/${modal.user.id}`, userData);
      toast.success('Usuario atualizado');
    } else {
      await api.post('/users', userData);
      toast.success('Usuario criado');
    }
    loadUsers();
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Remover usuario "${user.name}"?`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('Usuario removido');
      loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao remover');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <button onClick={() => setModal({ mode: 'new' })} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Usuario
        </button>
      </div>

      <div className="card">
        {isLoading ? (
          <p className="text-gray-400 text-center py-8">Carregando...</p>
        ) : users.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhum usuario cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b">
                  <th className="pb-3 font-medium">Nome</th>
                  <th className="pb-3 font-medium">Usuario</th>
                  <th className="pb-3 font-medium">Funcao</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="table-row">
                    <td className="py-3 font-medium">{u.name}</td>
                    <td className="py-3 text-gray-400">{u.username}</td>
                    <td className="py-3 text-gray-400">{u.role === 'admin' ? 'Administrador' : 'Operador'}</td>
                    <td className="py-3">
                      <span className={u.is_active ? 'text-green-600' : 'text-red-600'}>
                        {u.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setModal({ mode: 'edit', user: u })} className="p-1 text-gray-400 hover:text-blue-600">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(u)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <UserModal
          user={modal.mode === 'edit' ? modal.user : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
