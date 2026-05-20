import { useState, useEffect } from 'react';
import { Save, Store, Printer, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';

interface Settings {
  store_name: string;
  store_address: string;
  store_phone: string;
  opening_hours: string;
  delivery_fee: string;
  min_order: string;
  delivery_radius: string;
  printer_type: string;
  printer_interface: string;
  printer_ip: string;
  printer_port: string;
  printer_width: string;
  notify_sound: string;
  notify_orders: string;
  notify_whatsapp: string;
}

const defaultSettings: Settings = {
  store_name: '',
  store_address: '',
  store_phone: '',
  opening_hours: '',
  delivery_fee: '5.00',
  min_order: '20.00',
  delivery_radius: '5',
  printer_type: 'usb',
  printer_interface: 'USB',
  printer_ip: '',
  printer_port: '9100',
  printer_width: '48',
  notify_sound: 'true',
  notify_orders: 'true',
  notify_whatsapp: 'false',
};

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      if (data.success) {
        setSettings({ ...defaultSettings, ...data.data });
      }
    } catch {
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Configurações salvas');
    } catch {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof Settings, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Store size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold">Dados da Loja</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input type="text" value={settings.store_name} onChange={(e) => update('store_name', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
              <input type="text" value={settings.store_address} onChange={(e) => update('store_address', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input type="text" value={settings.store_phone} onChange={(e) => update('store_phone', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
              <input type="text" value={settings.opening_hours} onChange={(e) => update('opening_hours', e.target.value)} className="input w-full" />
            </div>
          </div>
        </div>

        {/* Delivery Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🚗</span>
            <h2 className="text-lg font-semibold">Delivery</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taxa de Entrega (R$)</label>
              <input type="number" step="0.01" value={settings.delivery_fee} onChange={(e) => update('delivery_fee', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pedido Mínimo (R$)</label>
              <input type="number" step="0.01" value={settings.min_order} onChange={(e) => update('min_order', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raio de Entrega (km)</label>
              <input type="number" value={settings.delivery_radius} onChange={(e) => update('delivery_radius', e.target.value)} className="input w-full" />
            </div>
          </div>
        </div>

        {/* Printer Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Printer size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold">Impressora</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={settings.printer_type} onChange={(e) => update('printer_type', e.target.value)} className="input w-full">
                <option value="usb">USB</option>
                <option value="network">Rede (TCP/IP)</option>
              </select>
            </div>
            {settings.printer_type === 'usb' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interface USB</label>
                <input type="text" value={settings.printer_interface} onChange={(e) => update('printer_interface', e.target.value)} className="input w-full" placeholder="USB" />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP da Impressora</label>
                  <input type="text" value={settings.printer_ip} onChange={(e) => update('printer_ip', e.target.value)} className="input w-full" placeholder="192.168.1.100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
                  <input type="number" value={settings.printer_port} onChange={(e) => update('printer_port', e.target.value)} className="input w-full" placeholder="9100" />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Largura do Cupom (caracteres)</label>
              <select value={settings.printer_width} onChange={(e) => update('printer_width', e.target.value)} className="input w-full">
                <option value="32">32 (58mm)</option>
                <option value="48">48 (80mm)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold">Notificações</h2>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.notify_sound === 'true'} onChange={(e) => update('notify_sound', e.target.checked ? 'true' : 'false')} className="rounded" />
              <span className="text-sm text-gray-700">Som de notificação</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.notify_orders === 'true'} onChange={(e) => update('notify_orders', e.target.checked ? 'true' : 'false')} className="rounded" />
              <span className="text-sm text-gray-700">Notificar novos pedidos</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.notify_whatsapp === 'true'} onChange={(e) => update('notify_whatsapp', e.target.checked ? 'true' : 'false')} className="rounded" />
              <span className="text-sm text-gray-700">Notificar mensagens WhatsApp</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={18} />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
}
