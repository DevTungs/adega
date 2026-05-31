import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, PowerOff, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClientStore, Client } from '../stores/clientStore';
import ClientModal from '../components/clients/ClientModal';

export default function Clients() {
  const { clients, isLoading, fetchAll, create, update, deactivate, activate, remove } = useClientStore();
  const [modal, setModal] = useState<{ mode: 'new' | 'edit'; client?: Client } | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetchAll(showInactive).catch(() => toast.error('Erro ao carregar clientes'));
  }, [fetchAll, showInactive]);

  const handleDeactivate = async (client: Client) => {
    if (!confirm(`Inativar cliente "${client.name}"? As licencas ativas serao bloqueadas.`)) return;
    try {
      await deactivate(client.id);
      toast.success('Cliente inativado');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao inativar');
    }
  };

  const handleActivate = async (client: Client) => {
    try {
      await activate(client.id);
      toast.success('Cliente reativado');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao reativar');
    }
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`ATENCAO: Excluir permanentemente "${client.name}"?\n\nIsso vai remover TODOS os dados do cliente (licencas, usuarios) e NAO pode ser desfeito.`)) return;
    try {
      await remove(client.id);
      toast.success('Cliente excluido permanentemente');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Mostrar inativos
          </label>
          <button onClick={() => setModal({ mode: 'new' })} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Novo Cliente
          </button>
        </div>
      </div>

      <div className="card">
        {isLoading && clients.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Carregando...</p>
        ) : clients.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhum cliente cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-3 font-medium">Nome</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Telefone</th>
                  <th className="pb-3 font-medium">GTIN</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Criado em</th>
                  <th className="pb-3 font-medium text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3 text-gray-400">{c.email || '-'}</td>
                    <td className="py-3 text-gray-400">{c.phone || '-'}</td>
                    <td className="py-3">
                      <span className={c.gtin_username ? 'text-green-400' : 'text-gray-500'}>
                        {c.gtin_username ? 'Configurado' : 'Nao configurado'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={c.is_active ? 'badge-active' : 'badge-blocked'}>
                        {c.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => setModal({ mode: 'edit', client: c })} className="text-gray-400 hover:text-blue-400 mr-3" title="Editar">
                        <Pencil size={16} />
                      </button>
                      {c.is_active ? (
                        <button onClick={() => handleDeactivate(c)} className="text-gray-400 hover:text-amber-400 mr-3" title="Inativar">
                          <PowerOff size={16} />
                        </button>
                      ) : (
                        <button onClick={() => handleActivate(c)} className="text-gray-400 hover:text-green-400 mr-3" title="Reativar">
                          <Power size={16} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(c)} className="text-gray-400 hover:text-red-400" title="Excluir permanentemente">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <ClientModal
          client={modal.mode === 'edit' ? modal.client : null}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            if (modal.mode === 'edit' && modal.client) {
              await update(modal.client.id, data);
              toast.success('Cliente atualizado');
            } else {
              await create(data);
              toast.success('Cliente criado');
            }
          }}
        />
      )}
    </div>
  );
}
