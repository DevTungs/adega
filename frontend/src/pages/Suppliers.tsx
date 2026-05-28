import { useEffect, useState } from 'react';
import { suppliersApi } from '../api/management';
import { Supplier } from '../types';
import { Plus, Edit, Trash2, Search, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import SupplierModal from '../components/suppliers/SupplierModal';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await suppliersApi.getAll();
      setSuppliers(res.data.data);
    } catch {
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este fornecedor?')) return;
    try {
      await suppliersApi.delete(id);
      setSuppliers(suppliers.filter((s) => s.id !== id));
      toast.success('Fornecedor removido');
    } catch {
      toast.error('Erro ao remover fornecedor');
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editingSupplier) {
        await suppliersApi.update(editingSupplier.id, data);
        toast.success('Fornecedor atualizado');
      } else {
        await suppliersApi.create(data);
        toast.success('Fornecedor criado');
      }
      setModalOpen(false);
      setEditingSupplier(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar fornecedor');
    }
  };

  const openEdit = (supplier: Supplier) => { setEditingSupplier(supplier); setModalOpen(true); };
  const openCreate = () => { setEditingSupplier(null); setModalOpen(true); };

  const filtered = suppliers.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.cnpj && s.cnpj.includes(search))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Novo Fornecedor
        </button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar fornecedores..."
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
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CNPJ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contato</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Truck size={16} className="text-blue-600" />
                      <div>
                        <span className="font-medium text-gray-900">{supplier.name}</span>
                        {supplier.address && <div className="text-sm text-gray-500">{supplier.address}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{supplier.cnpj || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {supplier.phone && <div>{supplier.phone}</div>}
                    {supplier.email && <div className="text-gray-500">{supplier.email}</div>}
                    {!supplier.phone && !supplier.email && '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      supplier.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {supplier.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(supplier)} className="p-1 text-gray-400 hover:text-blue-600">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(supplier.id)} className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <SupplierModal
          supplier={editingSupplier}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingSupplier(null); }}
        />
      )}
    </div>
  );
}
