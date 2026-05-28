import { useState, useEffect, useCallback } from 'react';
import { reportsApi } from '../api/reports';
import { formatCurrency, formatDate, PAYMENT_LABELS } from '../utils/format';
import { BarChart3, Package, Users, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Tab = 'sales' | 'inventory' | 'customers' | 'hours';

interface SalesSummary {
  totalOrders: number;
  totalRevenue: number;
  avgTicket: number;
}

interface PeriodRow {
  period: string;
  orders: number;
  revenue: number;
}

interface PaymentRow {
  payment_method: string;
  orders: number;
  revenue: number;
}

interface TopProduct {
  product_id: string;
  product_name: string;
  quantity: number;
  revenue: number;
}

interface CategoryRow {
  category_name: string;
  quantity: number;
  revenue: number;
}

interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
}

interface InventoryValuation {
  totalProducts: number;
  totalUnits: number;
  totalValue: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  min_stock: number;
  unit: string;
  category_name: string;
}

interface InventoryCategory {
  category_name: string;
  products: number;
  total_stock: number;
  value: number;
}

interface HourRow {
  hour: number;
  orders: number;
  revenue: number;
}

interface Comparison {
  current: { orders: number; revenue: number };
  previous: { orders: number; revenue: number };
  daysDiff: number;
}

const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'sales', label: 'Vendas', icon: BarChart3 },
  { key: 'inventory', label: 'Estoque', icon: Package },
  { key: 'customers', label: 'Clientes', icon: Users },
  { key: 'hours', label: 'Horários', icon: Clock },
];

function getQuickDates() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().split('T')[0];

  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthStr = monthAgo.toISOString().split('T')[0];

  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const yearStr = yearAgo.toISOString().split('T')[0];

  return { today, weekStr, monthStr, yearStr };
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="flex items-center gap-1 text-gray-500 text-sm"><Minus size={14} /> 0%</span>;
  if (value > 0) return <span className="flex items-center gap-1 text-green-600 text-sm"><TrendingUp size={14} /> +{value.toFixed(1)}%</span>;
  return <span className="flex items-center gap-1 text-red-600 text-sm"><TrendingDown size={14} /> {value.toFixed(1)}%</span>;
}

function BarChart({ data, maxVal, label }: { data: { label: string; value: number; color?: string }[]; maxVal: number; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-20 text-sm text-gray-600 text-right shrink-0">{item.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${item.color || 'bg-primary-500'}`}
              style={{ width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%` }}
            />
          </div>
          <span className="w-20 text-sm font-medium text-gray-900">{typeof item.value === 'number' && item.value > 100 ? formatCurrency(item.value) : item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [period, setPeriod] = useState('day');
  const [loading, setLoading] = useState(false);

  // Sales state
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [byPeriod, setByPeriod] = useState<PeriodRow[]>([]);
  const [byPayment, setByPayment] = useState<PaymentRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [profit, setProfit] = useState<{ revenue: number; cost: number } | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);

  // Inventory state
  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [invCategories, setInvCategories] = useState<InventoryCategory[]>([]);

  // Customers state
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);

  // Hours state
  const [hours, setHours] = useState<HourRow[]>([]);

  const quickDates = getQuickDates();

  const setQuickRange = (range: 'today' | 'week' | 'month' | 'year') => {
    const { today, weekStr, monthStr, yearStr } = quickDates;
    switch (range) {
      case 'today': setDateFrom(today); setDateTo(today); break;
      case 'week': setDateFrom(weekStr); setDateTo(today); break;
      case 'month': setDateFrom(monthStr); setDateTo(today); break;
      case 'year': setDateFrom(yearStr); setDateTo(today); break;
    }
  };

  const dateParams = { date_from: dateFrom || undefined, date_to: dateTo || undefined };

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, productsRes, catRes, profitRes, compRes] = await Promise.all([
        reportsApi.getSales({ period, ...dateParams }),
        reportsApi.getTopProducts({ limit: 10, sort: 'quantity', ...dateParams }),
        reportsApi.getCategories(dateParams),
        reportsApi.getProfit(dateParams),
        reportsApi.getComparison(dateParams),
      ]);
      setSummary(salesRes.data.data.summary);
      setByPeriod(salesRes.data.data.byPeriod);
      setByPayment(salesRes.data.data.byPayment);
      setTopProducts(productsRes.data.data);
      setCategories(catRes.data.data);
      setProfit(profitRes.data.data);
      setComparison(compRes.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [dateFrom, dateTo, period]);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [valRes, lowRes, catRes] = await Promise.all([
        reportsApi.getInventoryValuation(),
        reportsApi.getLowStock(),
        reportsApi.getInventoryByCategory(),
      ]);
      setValuation(valRes.data.data);
      setLowStock(lowRes.data.data);
      setInvCategories(catRes.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getTopCustomers({ limit: 20 });
      setTopCustomers(res.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadHours = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsApi.getHours(dateParams);
      setHours(res.data.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === 'sales') loadSales();
    else if (activeTab === 'inventory') loadInventory();
    else if (activeTab === 'customers') loadCustomers();
    else if (activeTab === 'hours') loadHours();
  }, [activeTab, loadSales, loadInventory, loadCustomers, loadHours]);

  const maxPaymentRevenue = Math.max(...byPayment.map(p => p.revenue), 1);
  const maxPeriodRevenue = Math.max(...byPeriod.map(p => p.revenue), 1);
  const maxHourOrders = Math.max(...hours.map(h => h.orders), 1);
  const maxCategoryRevenue = Math.max(...categories.map(c => c.revenue), 1);

  const profitValue = profit ? profit.revenue - profit.cost : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date range picker (for sales and hours tabs) */}
      {(activeTab === 'sales' || activeTab === 'hours') && (
        <div className="card">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">De:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input !w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Até:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input !w-auto"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setQuickRange('today')} className="btn-secondary text-sm">Hoje</button>
              <button onClick={() => setQuickRange('week')} className="btn-secondary text-sm">Semana</button>
              <button onClick={() => setQuickRange('month')} className="btn-secondary text-sm">Mês</button>
              <button onClick={() => setQuickRange('year')} className="btn-secondary text-sm">Ano</button>
            </div>
            {activeTab === 'sales' && (
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-sm text-gray-600">Agrupar:</label>
                <select value={period} onChange={(e) => setPeriod(e.target.value)} className="input !w-auto">
                  <option value="day">Dia</option>
                  <option value="week">Semana</option>
                  <option value="month">Mês</option>
                  <option value="year">Ano</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && !loading && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">Total de Pedidos</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.totalOrders || 0}</p>
              {comparison && <ChangeIndicator value={percentChange(comparison.current.orders, comparison.previous.orders)} />}
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Receita Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary?.totalRevenue)}</p>
              {comparison && <ChangeIndicator value={percentChange(comparison.current.revenue, comparison.previous.revenue)} />}
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Ticket Médio</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary?.avgTicket)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Lucro</p>
              <p className={`text-2xl font-bold ${profitValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(profitValue)}
              </p>
              {profit && <p className="text-xs text-gray-400">Custo: {formatCurrency(profit.cost)}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales over time */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Vendas por Período</h3>
              {byPeriod.length > 0 ? (
                <BarChart
                  data={byPeriod.map(p => ({ label: p.period, value: p.revenue }))}
                  maxVal={maxPeriodRevenue}
                  label={`${byPeriod.length} períodos`}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">Sem dados no período</p>
              )}
            </div>

            {/* Sales by payment method */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Vendas por Forma de Pagamento</h3>
              {byPayment.length > 0 ? (
                <BarChart
                  data={byPayment.map(p => ({
                    label: PAYMENT_LABELS[p.payment_method] || p.payment_method || 'N/A',
                    value: p.revenue,
                    color: p.payment_method === 'pix' ? 'bg-green-500' : p.payment_method === 'cash' ? 'bg-yellow-500' : 'bg-blue-500',
                  }))}
                  maxVal={maxPaymentRevenue}
                  label={`${byPayment.reduce((s, p) => s + p.orders, 0)} pedidos`}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">Sem dados</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top products */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Produtos Mais Vendidos</h3>
              {topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-gray-500 font-medium">#</th>
                        <th className="text-left py-2 text-gray-500 font-medium">Produto</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Qtd</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((p, i) => (
                        <tr key={p.product_id} className="border-b last:border-0">
                          <td className="py-2 text-gray-400">{i + 1}</td>
                          <td className="py-2 font-medium">{p.product_name}</td>
                          <td className="py-2 text-right">{p.quantity}</td>
                          <td className="py-2 text-right">{formatCurrency(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Sem dados</p>
              )}
            </div>

            {/* Categories */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Vendas por Categoria</h3>
              {categories.length > 0 ? (
                <BarChart
                  data={categories.map(c => ({ label: c.category_name, value: c.revenue }))}
                  maxVal={maxCategoryRevenue}
                  label={`${categories.length} categorias`}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">Sem dados</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && !loading && (
        <div className="space-y-6">
          {/* Valuation cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">Produtos Ativos</p>
              <p className="text-2xl font-bold text-gray-900">{valuation?.totalProducts || 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Unidades em Estoque</p>
              <p className="text-2xl font-bold text-gray-900">{valuation?.totalUnits || 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Valor do Estoque</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(valuation?.totalValue)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low stock */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 text-red-700">Estoque Baixo</h3>
              {lowStock.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-gray-500 font-medium">Produto</th>
                        <th className="text-left py-2 text-gray-500 font-medium">Categoria</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Estoque</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Mínimo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStock.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{p.name}</td>
                          <td className="py-2 text-gray-500">{p.category_name || '-'}</td>
                          <td className="py-2 text-right">
                            <span className={`font-bold ${p.stock === 0 ? 'text-red-600' : 'text-orange-500'}`}>
                              {p.stock} {p.unit}
                            </span>
                          </td>
                          <td className="py-2 text-right text-gray-400">{p.min_stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-green-600 text-center py-8">Todos os produtos com estoque adequado</p>
              )}
            </div>

            {/* By category */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Estoque por Categoria</h3>
              {invCategories.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-gray-500 font-medium">Categoria</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Produtos</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Unidades</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invCategories.map((c) => (
                        <tr key={c.category_name} className="border-b last:border-0">
                          <td className="py-2 font-medium">{c.category_name}</td>
                          <td className="py-2 text-right">{c.products}</td>
                          <td className="py-2 text-right">{c.total_stock}</td>
                          <td className="py-2 text-right">{formatCurrency(c.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Sem dados</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && !loading && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Top Clientes</h3>
            {topCustomers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-gray-500 font-medium">#</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Cliente</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Telefone</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Pedidos</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Total Gasto</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Último Pedido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((c, i) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2 text-gray-400">{i + 1}</td>
                        <td className="py-2 font-medium">{c.name || 'Sem nome'}</td>
                        <td className="py-2 text-gray-500">{c.phone}</td>
                        <td className="py-2 text-right">{c.total_orders}</td>
                        <td className="py-2 text-right font-medium">{formatCurrency(c.total_spent)}</td>
                        <td className="py-2 text-right text-gray-400">{c.last_order_at ? formatDate(c.last_order_at) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Nenhum cliente com pedidos</p>
            )}
          </div>
        </div>
      )}

      {/* Hours Tab */}
      {activeTab === 'hours' && !loading && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Pedidos por Hora do Dia</h3>
            {hours.length > 0 ? (
              <div className="flex items-end gap-1 h-64">
                {Array.from({ length: 24 }, (_, i) => {
                  const h = hours.find(row => row.hour === i);
                  const orders = h?.orders || 0;
                  const max = maxHourOrders;
                  const height = max > 0 ? (orders / max) * 100 : 0;
                  const isPeak = orders >= max * 0.7 && orders > 0;

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{orders > 0 ? orders : ''}</span>
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${isPeak ? 'bg-primary-600' : orders > 0 ? 'bg-primary-300' : 'bg-gray-100'}`}
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                      <span className="text-xs text-gray-400">{String(i).padStart(2, '0')}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Sem dados no período</p>
            )}
            {hours.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Horário de Pico</p>
                  <p className="text-lg font-bold text-primary-600">
                    {(() => {
                      const peak = hours.reduce((max, h) => h.orders > max.orders ? h : max, hours[0]);
                      return `${String(peak.hour).padStart(2, '0')}:00`;
                    })()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total de Pedidos</p>
                  <p className="text-lg font-bold">{hours.reduce((s, h) => s + h.orders, 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Receita Total</p>
                  <p className="text-lg font-bold">{formatCurrency(hours.reduce((s, h) => s + h.revenue, 0))}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
