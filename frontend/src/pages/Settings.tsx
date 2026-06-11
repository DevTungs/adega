import { useState, useEffect } from 'react';
import { Save, Store, Printer, Bell, RefreshCw, Plus, Trash2 } from 'lucide-react';
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
  printer_name: string;
  printer_interface: string;
  printer_ip: string;
  printer_port: string;
  printer_width: string;
  notify_sound: string;
  notify_orders: string;
  notify_whatsapp: string;
  pix_key: string;
  payment_methods: string;
  delivery_fee_ranges: string;
}

interface PaymentMethod {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  order: number;
}

interface DeliveryFeeRange {
  from: string;
  to: string;
  fee: number;
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
  printer_name: '',
  printer_interface: 'USB',
  printer_ip: '',
  printer_port: '9100',
  printer_width: '48',
  notify_sound: 'true',
  notify_orders: 'true',
  notify_whatsapp: 'false',
  pix_key: '',
  payment_methods: JSON.stringify([
    { id: 'cash', label: 'Dinheiro', icon: '1', enabled: true, order: 1 },
    { id: 'credit_card', label: 'Cartão de Crédito', icon: '2', enabled: true, order: 2 },
    { id: 'debit_card', label: 'Cartão de Débito', icon: '3', enabled: true, order: 3 },
    { id: 'pix', label: 'PIX', icon: '4', enabled: true, order: 4 },
    { id: 'voucher', label: 'Vale', icon: '5', enabled: true, order: 5 },
  ]),
  delivery_fee_ranges: JSON.stringify([
    { from: '00:00', to: '12:00', fee: 5.00 },
    { from: '12:00', to: '23:59', fee: 8.00 },
  ]),
};

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  useEffect(() => {
    loadSettings();
    loadPrinters();
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

  const loadPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const { data } = await api.get('/settings/printers');
      if (data.success) {
        setPrinters(data.data.printers || []);
      }
    } catch {
    } finally {
      setLoadingPrinters(false);
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

  const getPaymentMethods = (): PaymentMethod[] => {
    try { return JSON.parse(settings.payment_methods); } catch { return []; }
  };

  const updatePaymentMethods = (methods: PaymentMethod[]) => {
    update('payment_methods', JSON.stringify(methods));
  };

  const togglePaymentMethod = (id: string) => {
    const methods = getPaymentMethods();
    const idx = methods.findIndex(m => m.id === id);
    if (idx >= 0) {
      methods[idx].enabled = !methods[idx].enabled;
      updatePaymentMethods(methods);
    }
  };

  const getFeeRanges = (): DeliveryFeeRange[] => {
    try { return JSON.parse(settings.delivery_fee_ranges); } catch { return []; }
  };

  const updateFeeRanges = (ranges: DeliveryFeeRange[]) => {
    update('delivery_fee_ranges', JSON.stringify(ranges));
  };

  const addFeeRange = () => {
    const ranges = getFeeRanges();
    ranges.push({ from: '00:00', to: '23:59', fee: 5 });
    updateFeeRanges(ranges);
  };

  const removeFeeRange = (idx: number) => {
    const ranges = getFeeRanges();
    ranges.splice(idx, 1);
    updateFeeRanges(ranges);
  };

  const updateFeeRange = (idx: number, field: keyof DeliveryFeeRange, value: string | number) => {
    const ranges = getFeeRanges();
    (ranges[idx] as any)[field] = value;
    updateFeeRanges(ranges);
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
      <h1 className="text-2xl font-bold text-white">Configurações</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Store size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold">Dados da Loja</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
              <input type="text" value={settings.store_name} onChange={(e) => update('store_name', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Endereço</label>
              <input type="text" value={settings.store_address} onChange={(e) => update('store_address', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Telefone</label>
              <input type="text" value={settings.store_phone} onChange={(e) => update('store_phone', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Horário</label>
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
              <label className="block text-sm font-medium text-gray-300 mb-1">Taxa de Entrega Fixa (R$)</label>
              <input type="number" step="0.01" value={settings.delivery_fee} onChange={(e) => update('delivery_fee', e.target.value)} className="input w-full" />
              <p className="text-xs text-gray-400 mt-1">Usado quando nenhuma faixa horária abaixo está configurada</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-300">Faixas de Horário</label>
                <button type="button" onClick={addFeeRange} className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1">
                  <Plus size={12} /> Adicionar faixa
                </button>
              </div>
              <div className="space-y-2">
                {getFeeRanges().map((range, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="time" value={range.from} onChange={(e) => updateFeeRange(i, 'from', e.target.value)} className="input flex-1 text-sm" />
                    <span className="text-gray-400">ate</span>
                    <input type="time" value={range.to} onChange={(e) => updateFeeRange(i, 'to', e.target.value)} className="input flex-1 text-sm" />
                    <input type="number" step="0.01" value={range.fee} onChange={(e) => updateFeeRange(i, 'fee', parseFloat(e.target.value) || 0)} className="input w-20 text-sm" placeholder="R$" />
                    <button type="button" onClick={() => removeFeeRange(i)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                  </div>
                ))}
                {getFeeRanges().length === 0 && (
                  <p className="text-xs text-gray-500">Nenhuma faixa. Adicione uma faixa de horário.</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Pedido Mínimo (R$)</label>
              <input type="number" step="0.01" value={settings.min_order} onChange={(e) => update('min_order', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Raio de Entrega (km)</label>
              <input type="number" value={settings.delivery_radius} onChange={(e) => update('delivery_radius', e.target.value)} className="input w-full" />
            </div>
          </div>
        </div>

        {/* PIX Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">💳</span>
            <h2 className="text-lg font-semibold">PIX</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Chave PIX</label>
              <input type="text" value={settings.pix_key} onChange={(e) => update('pix_key', e.target.value)} className="input w-full" placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
              <p className="text-xs text-gray-400 mt-1">O bot mostrará esta chave quando o cliente escolher PIX</p>
            </div>
          </div>
        </div>

        {/* Payment Methods Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🪙</span>
            <h2 className="text-lg font-semibold">Métodos de Pagamento</h2>
          </div>
          <div className="space-y-2">
            {getPaymentMethods().map((method) => (
              <label key={method.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 cursor-pointer">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={method.enabled} onChange={() => togglePaymentMethod(method.id)} className="rounded" />
                  <span className="text-sm text-gray-200">{method.label}</span>
                </div>
                <span className="text-xs text-gray-500">{method.icon}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Marque/desmarque os métodos que estarão disponíveis no WhatsApp</p>
        </div>

        {/* Printer Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Printer size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold">Impressora</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
              <select value={settings.printer_type} onChange={(e) => update('printer_type', e.target.value)} className="input w-full">
                <option value="usb">USB / Local</option>
                <option value="network">Rede (TCP/IP)</option>
              </select>
            </div>
            {settings.printer_type === 'usb' ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-300">Impressora</label>
                  <button
                    type="button"
                    onClick={loadPrinters}
                    disabled={loadingPrinters}
                    className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={loadingPrinters ? 'animate-spin' : ''} />
                    {loadingPrinters ? 'Buscando...' : 'Atualizar lista'}
                  </button>
                </div>
                <select
                  value={settings.printer_name}
                  onChange={(e) => update('printer_name', e.target.value)}
                  className="input w-full"
                >
                  <option value="">Selecione uma impressora...</option>
                  {printers.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {printers.length === 0 && !loadingPrinters && (
                  <p className="text-xs text-gray-400 mt-1">Nenhuma impressora encontrada. Clique em "Atualizar lista".</p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">IP da Impressora</label>
                  <input type="text" value={settings.printer_ip} onChange={(e) => update('printer_ip', e.target.value)} className="input w-full" placeholder="192.168.1.100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Porta</label>
                  <input type="number" value={settings.printer_port} onChange={(e) => update('printer_port', e.target.value)} className="input w-full" placeholder="9100" />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Largura do Cupom (caracteres)</label>
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
              <span className="text-sm text-gray-300">Som de notificação</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.notify_orders === 'true'} onChange={(e) => update('notify_orders', e.target.checked ? 'true' : 'false')} className="rounded" />
              <span className="text-sm text-gray-300">Notificar novos pedidos</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={settings.notify_whatsapp === 'true'} onChange={(e) => update('notify_whatsapp', e.target.checked ? 'true' : 'false')} className="rounded" />
              <span className="text-sm text-gray-300">Notificar mensagens WhatsApp</span>
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
