import { useEffect, useState } from 'react';
import { customersApi } from '../api/customers';
import { Customer } from '../types';
import { formatCurrency, formatPhone, formatDateTime } from '../utils/format';
import { Search, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const { data } = await customersApi.getAll();
      setCustomers(data.data);
    } catch {
      toast.error('Erro ao carregar clientes');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(s)) ||
      c.phone.includes(s) ||
      (c.email && c.email.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>

      {isLoading ? (
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Telefone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Pedidos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Total Gasto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Último Pedido</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-white">{customer.name || 'Sem nome'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{formatPhone(customer.phone)}</td>
                  <td className="px-4 py-3 text-sm">{customer.total_orders}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(customer.total_spent)}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {customer.last_order_at ? formatDateTime(customer.last_order_at) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1 text-gray-400 hover:text-gray-400">
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
