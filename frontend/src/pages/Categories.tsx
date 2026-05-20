import { useEffect, useState } from 'react';
import { categoriesApi } from '../api/products';
import { Category } from '../types';
import { Plus, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import CategoryModal from '../components/categories/CategoryModal';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const { data } = await categoriesApi.getAll();
      setCategories(data.data);
    } catch {
      toast.error('Erro ao carregar categorias');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta categoria?')) return;
    try {
      await categoriesApi.delete(id);
      setCategories(categories.filter((c) => c.id !== id));
      toast.success('Categoria removida');
    } catch {
      toast.error('Erro ao remover categoria');
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, data);
        toast.success('Categoria atualizada');
      } else {
        await categoriesApi.create(data);
        toast.success('Categoria criada');
      }
      setModalOpen(false);
      setEditingCategory(null);
      loadCategories();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar categoria');
    }
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingCategory(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Nova Categoria
        </button>
      </div>

      {isLoading ? (
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                  <p className="text-sm text-gray-500">{cat.description || cat.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(cat)} className="p-1 text-gray-400 hover:text-blue-600">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <CategoryModal
          category={editingCategory}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingCategory(null); }}
        />
      )}
    </div>
  );
}
