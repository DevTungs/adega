import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClientUserStore, ClientUser } from '../stores/clientUserStore';
import { useClientStore } from '../stores/clientStore';
import UserModal from '../components/users/UserModal';

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
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-gray-400 mt-1">Gerencie os usuarios do aplicativo</p>
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
            <p className="text-gray-400">Nenhum usuario cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Username</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Nome</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Cliente</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-3 px-4 text-sm font-medium text-white">{user.username}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{user.name || '-'}</td>
                    <td className="py-3 px-4">
                      {user.client_name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/50 text-blue-400">
                          {user.client_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-400">
                          Super Admin
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditing(user); setShowModal(true); }} className="text-gray-400 hover:text-blue-400" title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(user)} className="text-gray-400 hover:text-red-400" title="Excluir">
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
