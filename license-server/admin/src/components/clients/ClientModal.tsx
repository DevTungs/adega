import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Client } from '../../stores/clientStore';

interface Props {
  client?: Client | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export default function ClientModal({ client, onClose, onSave }: Props) {
  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [notes, setNotes] = useState(client?.notes || '');
  const [gtinUsername, setGtinUsername] = useState(client?.gtin_username || '');
  const [gtinPassword, setGtinPassword] = useState(client?.gtin_password || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
        gtin_username: gtinUsername || undefined,
        gtin_password: gtinPassword || undefined,
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
          <h3 className="text-lg font-semibold text-white">{client ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
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

          <div className="border-t border-gray-800 pt-4">
            <p className="text-sm font-medium text-gray-300 mb-3">API GTIN (Consulta de Produtos)</p>
            <div className="space-y-3">
              <div>
                <label className="label">Usuario GTIN</label>
                <input value={gtinUsername} onChange={(e) => setGtinUsername(e.target.value)} className="input" placeholder="gtin.rscsistemas.com.br" />
              </div>
              <div>
                <label className="label">Senha GTIN</label>
                <input type="password" value={gtinPassword} onChange={(e) => setGtinPassword(e.target.value)} className="input" placeholder="Senha da API GTIN" />
              </div>
              <p className="text-xs text-gray-500">Credenciais do gtin.rscsistelas.com.br. Cada cliente usa seu proprio acesso.</p>
            </div>
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
