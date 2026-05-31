import { useState, useEffect } from 'react';
import { X, DollarSign, ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from 'lucide-react';
import { cashRegisterApi } from '../../api/cash-register';
import { formatCurrency } from '../../utils/format';
import toast from 'react-hot-toast';

interface CashRegisterSummary {
  register: { id: string; status: string; opened_by: string; opened_at: string };
  opening_amount: number;
  total_sales: number;
  total_sangria: number;
  total_suprimento: number;
  expected_closing: number;
  sales_by_payment: Array<{ payment_method: string; total: number; count: number }>;
  movements: Array<{ id: string; type: string; amount: number; description: string; created_at: string }>;
}

type ModalView = 'menu' | 'open' | 'close' | 'movement' | 'summary';

interface Props {
  onClose: () => void;
  onStatusChange: () => void;
}

export default function CashRegisterModal({ onClose, onStatusChange }: Props) {
  const [view, setView] = useState<ModalView>('menu');
  const [summary, setSummary] = useState<CashRegisterSummary | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [movementType, setMovementType] = useState<'sangria' | 'suprimento'>('sangria');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCurrent();
  }, []);

  const loadCurrent = async () => {
    try {
      const { data } = await cashRegisterApi.getCurrent();
      setSummary(data.data);
      if (data.data) setView('summary');
    } catch {}
  };

  const handleOpen = async () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (isNaN(value) || value < 0) return toast.error('Informe um valor válido');
    setLoading(true);
    try {
      const { data } = await cashRegisterApi.open(value);
      setSummary(data.data);
      setView('summary');
      setAmount('');
      toast.success('Caixa aberto!');
      onStatusChange();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao abrir caixa');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (isNaN(value) || value < 0) return toast.error('Informe um valor válido');
    setLoading(true);
    try {
      await cashRegisterApi.close(value);
      setSummary(null);
      setView('menu');
      setAmount('');
      toast.success('Caixa fechado!');
      onStatusChange();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao fechar caixa');
    } finally {
      setLoading(false);
    }
  };

  const handleMovement = async () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (isNaN(value) || value <= 0) return toast.error('Informe um valor válido');
    setLoading(true);
    try {
      const { data } = await cashRegisterApi.addMovement(movementType, value, description || undefined);
      setSummary(data.data);
      setView('summary');
      setAmount('');
      setDescription('');
      toast.success(movementType === 'sangria' ? 'Sangria registrada' : 'Suprimento registrado');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao registrar movimentação');
    } finally {
      setLoading(false);
    }
  };

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Dinheiro', credit_card: 'Crédito', debit_card: 'Débito', pix: 'PIX', voucher: 'Vale',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <DollarSign size={20} />
            Controle de Caixa
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded"><X size={20} /></button>
        </div>

        <div className="p-4">
          {/* Menu */}
          {view === 'menu' && (
            <div className="space-y-3">
              <p className="text-gray-500 text-sm">Nenhum caixa aberto no momento.</p>
              <button onClick={() => setView('open')} className="btn-primary w-full flex items-center justify-center gap-2">
                <Unlock size={18} /> Abrir Caixa
              </button>
            </div>
          )}

          {/* Open */}
          {view === 'open' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor de Abertura (R$)</label>
                <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className="input" autoFocus />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView('menu')} className="btn-secondary flex-1">Voltar</button>
                <button onClick={handleOpen} disabled={loading} className="btn-primary flex-1">{loading ? 'Abrindo...' : 'Abrir Caixa'}</button>
              </div>
            </div>
          )}

          {/* Summary */}
          {view === 'summary' && summary && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <span className="text-green-700 font-semibold text-sm">CAIXA ABERTO</span>
                <p className="text-xs text-green-600 mt-1">por {summary.register.opened_by} em {new Date(summary.register.opened_at).toLocaleString('pt-BR')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Abertura</p>
                  <p className="font-bold">{formatCurrency(summary.opening_amount)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Vendas</p>
                  <p className="font-bold text-green-600">{formatCurrency(summary.total_sales)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Sangrias</p>
                  <p className="font-bold text-red-600">-{formatCurrency(summary.total_sangria)}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Suprimentos</p>
                  <p className="font-bold text-blue-600">+{formatCurrency(summary.total_suprimento)}</p>
                </div>
              </div>

              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-center">
                <p className="text-xs text-primary-600">Valor Esperado no Fechamento</p>
                <p className="text-xl font-bold text-primary-700">{formatCurrency(summary.expected_closing)}</p>
              </div>

              {summary.sales_by_payment.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Vendas por Forma de Pagamento</p>
                  <div className="space-y-1">
                    {summary.sales_by_payment.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm bg-gray-800/50 rounded px-3 py-1.5">
                        <span>{PAYMENT_LABELS[p.payment_method] || p.payment_method}</span>
                        <span className="font-medium">{formatCurrency(p.total)} ({p.count}x)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => { setMovementType('sangria'); setView('movement'); }} className="btn-secondary flex-1 flex items-center justify-center gap-1">
                  <ArrowDownCircle size={16} /> Sangria
                </button>
                <button onClick={() => { setMovementType('suprimento'); setView('movement'); }} className="btn-secondary flex-1 flex items-center justify-center gap-1">
                  <ArrowUpCircle size={16} /> Suprimento
                </button>
              </div>
              <button onClick={() => setView('close')} className="btn-primary w-full flex items-center justify-center gap-2">
                <Lock size={18} /> Fechar Caixa
              </button>
            </div>
          )}

          {/* Movement */}
          {view === 'movement' && (
            <div className="space-y-4">
              <h3 className="font-medium">{movementType === 'sangria' ? 'Sangria (Retirada)' : 'Suprimento (Entrada)'}</h3>
              <div>
                <label className="block text-sm font-medium mb-1">Valor (R$)</label>
                <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className="input" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descrição (opcional)</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Motivo da movimentação" className="input" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setView('summary')} className="btn-secondary flex-1">Voltar</button>
                <button onClick={handleMovement} disabled={loading} className="btn-primary flex-1">{loading ? 'Registrando...' : 'Registrar'}</button>
              </div>
            </div>
          )}

          {/* Close */}
          {view === 'close' && summary && (
            <div className="space-y-4">
              <h3 className="font-medium">Fechar Caixa</h3>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Valor Esperado</p>
                <p className="text-lg font-bold">{formatCurrency(summary.expected_closing)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor em Caixa (contagem física)</label>
                <input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className="input" autoFocus />
              </div>
              {amount && (() => {
                const diff = parseFloat(amount.replace(',', '.')) - summary.expected_closing;
                if (isNaN(diff)) return null;
                return (
                  <div className={`rounded-lg p-3 text-center ${Math.abs(diff) < 0.01 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <p className="text-sm font-medium">{diff >= 0 ? 'Sobra' : 'Falta'}: {formatCurrency(Math.abs(diff))}</p>
                  </div>
                );
              })()}
              <div className="flex gap-2">
                <button onClick={() => setView('summary')} className="btn-secondary flex-1">Voltar</button>
                <button onClick={handleClose} disabled={loading} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">{loading ? 'Fechando...' : 'Confirmar Fechamento'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
