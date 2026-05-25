import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClientUserStore, ClientUser } from '../stores/clientUserStore';
import { useClientStore, Client } from '../stores/clientStore';

function UserModal({ user, clients, onClose, onSave }: { user?: ClientUser | null; clients: Client[]; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [clientId, setClientId] = useState(user?.client_id || '');
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        client_id: clientId || null,
        username,
        password: password || undefined,
        name: name || undefined,
      });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">{user ? 'Editar Usuario' : 'Novo Usuario'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Cliente (opcional)</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input">
              <option value="">Sem vinculo (super admin)</option>
              {clients.filter(c => c.is_active).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Se vazio, o usuario nao fica vinculado a nenhum cliente</p>
          </div>
          <div>
            <label className="label">Username *</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Senha {user ? '(deixe vazio para manter)' : '*'}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" minLength={4} required={!user} />
          </div>
          <div>
            <label className="label">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClientUsers() {
  const { users, isLoading, fetchAll, create, update, remove } = useClientUserStore();
  const { clients, fetchAll: fetchClients } = useClientStore();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClientUser | null>(null);

  useEffect(() => {
    fetchAll();
    fetchClients();
  }, [fetchAll, fetchClients]);

  const handleCreate = async (data: any) => {
    await create(data);
    toast.success('Usuario criado');
  };

  const handleUpdate = async (data: any) => {
    if (editing) {
      await update(editing.id, data);
      toast.success('Usuario atualizado');
    }
  };

  const handleDelete = async (user: ClientUser) => {
    if (!confirm(`Remover o usuario "${user.username}"?`)) return;
    try {
      await remove(user.id);
      toast.success('Usuario removido');
    } catch {
      toast.error('Erro ao remover');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-600 mt-1">Gerencie os usuarios do aplicativo</p>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Usuario
        </button>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhum usuario cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Username</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Nome</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Cliente</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{user.username}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{user.name || '-'}</td>
                    <td className="py-3 px-4">
                      {user.client_name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {user.client_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Super Admin
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditing(user); setShowModal(true); }} className="text-gray-400 hover:text-blue-600" title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(user)} className="text-gray-400 hover:text-red-600" title="Excluir">
                          <Trash2 size={16} />
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

      {showModal && (
        <UserModal
          user={editing}
          clients={clients}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={editing ? handleUpdate : handleCreate}
        />
      )}
    </div>
  );
}
