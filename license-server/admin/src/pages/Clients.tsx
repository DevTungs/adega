import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClientStore, Client } from '../stores/clientStore';

function ClientModal({ client, onClose, onSave }: { client?: Client | null; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [notes, setNotes] = useState(client?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ name, email: email || undefined, phone: phone || undefined, notes: notes || undefined });
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
          <h3 className="text-lg font-semibold">{client ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Observacoes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} />
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

export default function Clients() {
  const { clients, isLoading, fetchAll, create, update, remove } = useClientStore();
  const [modal, setModal] = useState<{ mode: 'new' | 'edit'; client?: Client } | null>(null);

  useEffect(() => {
    fetchAll().catch(() => toast.error('Erro ao carregar clientes'));
  }, [fetchAll]);

  const handleDelete = async (client: Client) => {
    if (!confirm(`Excluir cliente "${client.name}"?`)) return;
    try {
      await remove(client.id);
      toast.success('Cliente excluido');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <button onClick={() => setModal({ mode: 'new' })} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Novo Cliente
        </button>
      </div>

      <div className="card">
        {isLoading && clients.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Carregando...</p>
        ) : clients.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum cliente cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-3 font-medium">Nome</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Telefone</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Criado em</th>
                  <th className="pb-3 font-medium text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3 text-gray-500">{c.email || '-'}</td>
                    <td className="py-3 text-gray-500">{c.phone || '-'}</td>
                    <td className="py-3">
                      <span className={c.is_active ? 'badge-active' : 'badge-blocked'}>
                        {c.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => setModal({ mode: 'edit', client: c })} className="text-gray-400 hover:text-blue-600 mr-3">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(c)} className="text-gray-400 hover:text-red-600">
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
