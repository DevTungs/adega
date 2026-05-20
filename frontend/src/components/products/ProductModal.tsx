import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Product, Category } from '../../types';

interface Props {
  product?: Product | null;
  categories: Category[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export default function ProductModal({ product, categories, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    name: '',
    category_id: '',
    price: '',
    promo_price: '',
    cost_price: '',
    stock: '0',
    min_stock: '5',
    unit: 'un',
    volume: '',
    brand: '',
    description: '',
    image_url: '',
    barcode: '',
    is_featured: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        category_id: product.category_id || '',
        price: String(product.price || ''),
        promo_price: product.promo_price ? String(product.promo_price) : '',
        cost_price: product.cost_price ? String(product.cost_price) : '',
        stock: String(product.stock || 0),
        min_stock: '5',
        unit: product.unit || 'un',
        volume: product.volume || '',
        brand: product.brand || '',
        description: product.description || '',
        image_url: product.image_url || '',
        barcode: '',
        is_featured: product.is_featured === 1,
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category_id || !form.price) return;

    setSaving(true);
    try {
      await onSave({
        name: form.name,
        category_id: form.category_id,
        price: parseFloat(form.price),
        promo_price: form.promo_price ? parseFloat(form.promo_price) : null,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        stock: parseInt(form.stock) || 0,
        min_stock: parseInt(form.min_stock) || 5,
        unit: form.unit,
        volume: form.volume || null,
        brand: form.brand || null,
        description: form.description || null,
        image_url: form.image_url || null,
        barcode: form.barcode || null,
        is_featured: form.is_featured ? 1 : 0,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {product ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="input w-full"
              required
            >
              <option value="">Selecione...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preço *</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promo</label>
              <input
                type="number"
                step="0.01"
                value={form.promo_price}
                onChange={(e) => setForm({ ...form, promo_price: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custo</label>
              <input
                type="number"
                step="0.01"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estoque</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="input w-full"
              >
                <option value="un">Unidade</option>
                <option value="kg">Quilo</option>
                <option value="l">Litro</option>
                <option value="ml">Mililitro</option>
                <option value="g">Grama</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volume</label>
              <input
                type="text"
                placeholder="ex: 350ml"
                value={form.volume}
                onChange={(e) => setForm({ ...form, volume: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagem URL</label>
              <input
                type="text"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input w-full"
              rows={2}
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Produto em destaque</span>
          </label>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Salvando...' : product ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
