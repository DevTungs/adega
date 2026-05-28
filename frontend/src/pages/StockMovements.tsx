import { useEffect, useState } from 'react';
import { stockApi } from '../api/stock';
import { productsApi } from '../api/products';
import { Product } from '../types';
import { formatCurrency, formatDateTime } from '../utils/format';
import { Package, ArrowDown, ArrowUp, AlertTriangle, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import StockEntryForm from '../components/stock/StockEntryForm';

interface StockMovement {
  id: string;
  product_id: string;
  product_name: string;
  current_stock: number;
  type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

interface StockSummary {
  total_entries_today: number;
  total_exits_today: number;
  inventory_value: number;
  low_stock_count: number;
}

const TYPE_LABELS: Record<string, string> = {
  entry: 'Entrada',
  sale: 'Venda',
  cancellation: 'Cancelamento',
  adjustment: 'Ajuste',
  loss: 'Perda',
};

const TYPE_COLORS: Record<string, string> = {
  entry: 'bg-green-100 text-green-800',
  sale: 'bg-red-100 text-red-800',
  cancellation: 'bg-blue-100 text-blue-800',
  adjustment: 'bg-yellow-100 text-yellow-800',
  loss: 'bg-red-100 text-red-800',
};

export default function StockMovements() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    product_id: '',
    type: '',
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [movRes, prodRes, sumRes] = await Promise.all([
        stockApi.getMovements(),
        productsApi.getAll(),
        stockApi.getSummary(),
      ]);
      setMovements(movRes.data.data);
      setProducts(prodRes.data.data);
      setSummary(sumRes.data.data);
    } catch {
      toast.error('Erro ao carregar movimentações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilter = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (filters.product_id) params.product_id = filters.product_id;
      if (filters.type) params.type = filters.type;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const res = await stockApi.getMovements(params);
      setMovements(res.data.data);
    } catch {
      toast.error('Erro ao filtrar movimentações');
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({ product_id: '', type: '', date_from: '', date_to: '' });
    loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Entrada de Mercadoria
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <ArrowDown size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Entradas hoje</p>
              <p className="text-2xl font-bold text-gray-900">{summary.total_entries_today}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <ArrowUp size={24} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Saídas hoje</p>
              <p className="text-2xl font-bold text-gray-900">{summary.total_exits_today}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Valor do inventário</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.inventory_value)}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle size={24} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Estoque baixo</p>
              <p className="text-2xl font-bold text-gray-900">{summary.low_stock_count}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm text-gray-500 mb-1 block">Produto</label>
          <select
            value={filters.product_id}
            onChange={(e) => setFilters({ ...filters, product_id: e.target.value })}
            className="input w-full"
          >
            <option value="">Todos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="text-sm text-gray-500 mb-1 block">Tipo</label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="input w-full"
          >
            <option value="">Todos</option>
            <option value="entry">Entrada</option>
            <option value="sale">Venda</option>
            <option value="cancellation">Cancelamento</option>
            <option value="adjustment">Ajuste</option>
            <option value="loss">Perda</option>
          </select>
        </div>
        <div className="w-40">
          <label className="text-sm text-gray-500 mb-1 block">De</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            className="input w-full"
          />
        </div>
        <div className="w-40">
          <label className="text-sm text-gray-500 mb-1 block">Até</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            className="input w-full"
          />
        </div>
        <button onClick={handleFilter} className="btn-primary flex items-center gap-2">
          <Search size={16} />
          Filtrar
        </button>
        <button onClick={clearFilters} className="btn-secondary">
          Limpar
        </button>
      </div>

      {/* Movements Table */}
      {isLoading ? (
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qtd</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Anterior</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Novo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsável</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Obs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma movimentação encontrada
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(m.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{m.product_name}</div>
                      <div className="text-sm text-gray-500">Estoque: {m.current_stock}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${TYPE_COLORS[m.type] || 'bg-gray-100 text-gray-800'}`}>
                        {TYPE_LABELS[m.type] || m.type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{m.previous_stock}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">{m.new_stock}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.created_by || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{m.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <StockEntryForm
          products={products}
          onSave={() => { setModalOpen(false); loadData(); }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
