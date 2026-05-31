import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { License } from '../../stores/licenseStore';

export default function RenewModal({ license, onClose, onSave }: { license: License; onClose: () => void; onSave: (expires_at: string) => Promise<void> }) {
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setExpiresAt(d.toISOString().slice(0, 10));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(expiresAt);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao renovar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Renovar Licenca</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-400">Chave: <code className="bg-gray-800 px-2 py-0.5 rounded">{license.license_key}</code></p>
          <div>
            <label className="label">Nova data de vencimento *</label>
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="input" required />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Renovando...' : 'Renovar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
