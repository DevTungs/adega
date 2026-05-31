import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { ClientUser } from '../../stores/clientUserStore';
import { Client } from '../../stores/clientStore';

interface UserModalProps {
  user?: ClientUser | null;
  clients: Client[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export default function UserModal({ user, clients, onClose, onSave }: UserModalProps) {
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
      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">{user ? 'Editar Usuario' : 'Novo Usuario'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
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
            <p className="text-xs text-gray-500 mt-1">Se vazio, o usuario fica vinculado a nenhum cliente</p>
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
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
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
