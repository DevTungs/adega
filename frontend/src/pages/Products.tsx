import { useEffect, useState } from 'react';
import { productsApi, categoriesApi } from '../api/products';
import { Product, Category } from '../types';
import { formatCurrency } from '../utils/format';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductModal from '../components/products/ProductModal';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        productsApi.getAll(),
        categoriesApi.getAll(),
      ]);
      setProducts(prodRes.data.data);
      setCategories(catRes.data.data);
    } catch {
      toast.error('Erro ao carregar produtos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este produto?')) return;
    try {
      await productsApi.delete(id);
      setProducts(products.filter((p) => p.id !== id));
      toast.success('Produto removido');
    } catch {
      toast.error('Erro ao remover produto');
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editingProduct) {
        await productsApi.update(editingProduct.id, data);
        toast.success('Produto atualizado');
      } else {
        await productsApi.create(data);
        toast.success('Produto criado');
      }
      setModalOpen(false);
      setEditingProduct(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar produto');
    }
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || p.category_id === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Novo Produto
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">Todas categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preço</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((product) => {
                const cat = categories.find((c) => c.id === product.category_id);
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.volume || product.unit}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{cat?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{formatCurrency(product.promo_price || product.price)}</div>
                      {product.promo_price && (
                        <div className="text-sm text-gray-400 line-through">{formatCurrency(product.price)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${product.stock <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(product)} className="p-1 text-gray-400 hover:text-blue-600">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingProduct(null); }}
        />
      )}
    </div>
  );
}
