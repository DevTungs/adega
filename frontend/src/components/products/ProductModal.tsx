import { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2, Edit, Package, Puzzle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Product, Category, ProductVariant, ProductModifier, ModifierOption } from '../../types';
import { productsApi } from '../../api/products';

interface Props {
  product?: Product | null;
  categories: Category[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

type Tab = 'dados' | 'variants' | 'modifiers';

export default function ProductModal({ product, categories, onSave, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('dados');
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  // Product form
  const [form, setForm] = useState({
    name: '', category_id: '', price: '', promo_price: '', cost_price: '',
    stock: '0', min_stock: '5', unit: 'un', volume: '', brand: '',
    description: '', image_url: '', barcode: '', is_featured: false,
  });

  // Variants
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantForm, setVariantForm] = useState({ name: '', description: '', price: '', promo_price: '', stock: '', barcode: '' });
  const [showVariantForm, setShowVariantForm] = useState(false);

  // Modifiers
  const [modifiers, setModifiers] = useState<ProductModifier[]>([]);
  const [editingModifier, setEditingModifier] = useState<ProductModifier | null>(null);
  const [modifierForm, setModifierForm] = useState({ name: '', type: 'single' as 'single' | 'multiple' | 'required', min_select: '0', max_select: '1', creates_splits: false });
  const [showModifierForm, setShowModifierForm] = useState(false);

  // Modifier options
  const [selectedModifier, setSelectedModifier] = useState<ProductModifier | null>(null);
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null);
  const [optionForm, setOptionForm] = useState({ name: '', price_add: '' });
  const [showOptionForm, setShowOptionForm] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '', category_id: product.category_id || '',
        price: String(product.price || ''), promo_price: product.promo_price ? String(product.promo_price) : '',
        cost_price: product.cost_price ? String(product.cost_price) : '',
        stock: String(product.stock || 0), min_stock: '5', unit: product.unit || 'un',
        volume: product.volume || '', brand: product.brand || '',
        description: product.description || '', image_url: product.image_url || '',
        barcode: product.barcode || '', is_featured: product.is_featured === 1,
      });
      loadVariants();
      loadModifiers();
    }
  }, [product]);

  const loadVariants = async () => {
    if (!product) return;
    try {
      const res = await productsApi.getVariants(product.id);
      setVariants(res.data || []);
    } catch { setVariants([]); }
  };

  const loadModifiers = async () => {
    if (!product) return;
    try {
      const res = await productsApi.getModifiers(product.id);
      setModifiers(res.data || []);
    } catch { setModifiers([]); }
  };

  const handleBarcodeSearch = async () => {
    if (!form.barcode.trim() || searching) return;
    setSearching(true);
    try {
      const result = await productsApi.searchByBarcode(form.barcode.trim());
      if (result.found && result.source === 'api') {
        const p = result.product;
        setForm(prev => ({
          ...prev, name: p.name || prev.name, brand: p.brand || prev.brand,
          volume: p.volume || prev.volume, image_url: p.image_url || prev.image_url,
          description: p.description || prev.description,
        }));
      } else if (!result.found) {
        toast.error(result.error || 'Produto nao encontrado. Preencha os dados manualmente.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao buscar codigo de barras.');
    } finally { setSearching(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category_id || form.price === undefined || form.price === null || form.price === '') return;
    setSaving(true);
    try {
      await onSave({
        name: form.name, category_id: form.category_id, price: parseFloat(form.price) || 0,
        promo_price: form.promo_price ? parseFloat(form.promo_price) : null,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
        stock: parseInt(form.stock) || 0, min_stock: parseInt(form.min_stock) || 5,
        unit: form.unit, volume: form.volume || null, brand: form.brand || null,
        description: form.description || null, image_url: form.image_url || null,
        barcode: form.barcode || null, is_featured: form.is_featured ? 1 : 0,
      });
    } finally { setSaving(false); }
  };

  // --- Variant handlers ---
  const handleSaveVariant = async () => {
    if (!product || !variantForm.name || !variantForm.price) return;
    try {
      const data = {
        product_id: editingVariant ? editingVariant.product_id : product.id,
        name: variantForm.name, description: variantForm.description || null,
        price: parseFloat(variantForm.price),
        promo_price: variantForm.promo_price ? parseFloat(variantForm.promo_price) : null,
        stock: variantForm.stock ? parseInt(variantForm.stock) : null,
        barcode: variantForm.barcode || null,
      };
      if (editingVariant) {
        await productsApi.updateVariant(editingVariant.id, data);
        toast.success('Variação atualizada');
      } else {
        await productsApi.createVariant(data);
        toast.success('Variação criada');
      }
      resetVariantForm();
      loadVariants();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar variação');
    }
  };

  const resetVariantForm = () => {
    setShowVariantForm(false);
    setEditingVariant(null);
    setVariantForm({ name: '', description: '', price: '', promo_price: '', stock: '', barcode: '' });
  };

  const openEditVariant = (v: ProductVariant) => {
    setEditingVariant(v);
    setVariantForm({
      name: v.name, description: v.description || '', price: String(v.price),
      promo_price: v.promo_price ? String(v.promo_price) : '',
      stock: v.stock !== null ? String(v.stock) : '', barcode: v.barcode || '',
    });
    setShowVariantForm(true);
  };

  const handleDeleteVariant = async (id: string) => {
    if (!confirm('Remover esta variação?')) return;
    try {
      await productsApi.deleteVariant(id);
      toast.success('Variação removida');
      loadVariants();
    } catch { toast.error('Erro ao remover variação'); }
  };

  // --- Modifier handlers ---
  const handleSaveModifier = async () => {
    if (!product || !modifierForm.name) return;
    try {
      const data = {
        product_id: editingModifier ? editingModifier.product_id : product.id,
        name: modifierForm.name, type: modifierForm.type,
        min_select: parseInt(modifierForm.min_select) || 0,
        max_select: parseInt(modifierForm.max_select) || 1,
        creates_splits: modifierForm.creates_splits ? 1 : 0,
      };
      if (editingModifier) {
        await productsApi.updateModifier(editingModifier.id, data);
        toast.success('Modificador atualizado');
      } else {
        await productsApi.createModifier(data);
        toast.success('Modificador criado');
      }
      resetModifierForm();
      loadModifiers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar modificador');
    }
  };

  const resetModifierForm = () => {
    setShowModifierForm(false);
    setEditingModifier(null);
    setModifierForm({ name: '', type: 'single', min_select: '0', max_select: '1', creates_splits: false });
  };

  const openEditModifier = (m: ProductModifier) => {
    setEditingModifier(m);
    setModifierForm({
      name: m.name, type: m.type,
      min_select: String(m.min_select || 0), max_select: String(m.max_select || 1),
      creates_splits: m.creates_splits === 1,
    });
    setShowModifierForm(true);
  };

  const handleDeleteModifier = async (id: string) => {
    if (!confirm('Remover este modificador?')) return;
    try {
      await productsApi.deleteModifier(id);
      toast.success('Modificador removido');
      if (selectedModifier?.id === id) setSelectedModifier(null);
      loadModifiers();
    } catch { toast.error('Erro ao remover modificador'); }
  };

  // --- Option handlers ---
  const handleSaveOption = async () => {
    if (!selectedModifier || !optionForm.name) return;
    try {
      const data = {
        modifier_id: editingOption ? editingOption.modifier_id : selectedModifier.id,
        name: optionForm.name,
        price_add: optionForm.price_add ? parseFloat(optionForm.price_add) : 0,
      };
      if (editingOption) {
        await productsApi.updateModifierOption(editingOption.id, data);
        toast.success('Opção atualizada');
      } else {
        await productsApi.createModifierOption(data);
        toast.success('Opção criada');
      }
      resetOptionForm();
      loadModifiers();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar opção');
    }
  };

  const resetOptionForm = () => {
    setShowOptionForm(false);
    setEditingOption(null);
    setOptionForm({ name: '', price_add: '' });
  };

  const openEditOption = (o: ModifierOption) => {
    setEditingOption(o);
    setOptionForm({ name: o.name, price_add: o.price_add ? String(o.price_add) : '' });
    setShowOptionForm(true);
  };

  const handleDeleteOption = async (id: string) => {
    if (!confirm('Remover esta opção?')) return;
    try {
      await productsApi.deleteModifierOption(id);
      toast.success('Opção removida');
      loadModifiers();
    } catch { toast.error('Erro ao remover opção'); }
  };

  const isEditing = !!product;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">
            {product ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button onClick={() => setTab('dados')} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'dados' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            <Search size={16} /> Dados
          </button>
          <button onClick={() => { if (isEditing) setTab('variants'); else toast('Salve o produto primeiro'); }} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'variants' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            <Package size={16} /> Variações {variants.length > 0 && <span className="bg-primary-100 text-primary-700 text-xs px-1.5 py-0.5 rounded-full">{variants.length}</span>}
          </button>
          <button onClick={() => { if (isEditing) setTab('modifiers'); else toast('Salve o produto primeiro'); }} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'modifiers' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
            <Puzzle size={16} /> Modificadores {modifiers.length > 0 && <span className="bg-primary-100 text-primary-700 text-xs px-1.5 py-0.5 rounded-full">{modifiers.length}</span>}
          </button>
        </div>

        {/* Tab: Dados */}
        {tab === 'dados' && (
          <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Código de Barras</label>
              <div className="flex gap-2">
                <input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !searching) { e.preventDefault(); handleBarcodeSearch(); } }}
                  placeholder="Digite ou escaneie o código" className="input flex-1" />
                <button type="button" onClick={handleBarcodeSearch} disabled={searching || !form.barcode.trim()}
                  className="btn-secondary flex items-center gap-1"><Search size={16} />{searching ? 'Buscando...' : 'Buscar'}</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nome *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Categoria *</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input w-full" required>
                <option value="">Selecione...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Preço *</label>
                <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input w-full" required /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Promo</label>
                <input type="number" step="0.01" value={form.promo_price} onChange={(e) => setForm({ ...form, promo_price: e.target.value })} className="input w-full" /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Custo</label>
                <input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} className="input w-full" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Estoque</label>
                <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input w-full" /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Unidade</label>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input w-full">
                  <option value="un">Unidade</option><option value="kg">Quilo</option><option value="l">Litro</option>
                  <option value="ml">Mililitro</option><option value="g">Grama</option>
                </select></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Volume</label>
                <input type="text" placeholder="ex: 350ml" value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} className="input w-full" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Marca</label>
                <input type="text" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="input w-full" /></div>
              <div><label className="block text-sm font-medium text-gray-300 mb-1">Imagem URL</label>
                <input type="text" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="input w-full" /></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input w-full" rows={2} /></div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="rounded" />
              <span className="text-sm text-gray-300">Produto em destaque</span>
            </label>
            {!isEditing && (
              <div className="text-xs text-gray-500 italic">Após criar, configure Variações e Modificadores nas abas ao lado.</div>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}</button>
            </div>
          </form>
        )}

        {/* Tab: Variações */}
        {tab === 'variants' && (
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">Tamanhos / Variações</h3>
              <button onClick={() => { resetVariantForm(); setShowVariantForm(true); }} className="btn-primary flex items-center gap-1 text-sm px-3 py-1.5">
                <Plus size={14} /> Nova
              </button>
            </div>

            {showVariantForm && (
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-400">Nome *</label>
                    <input type="text" value={variantForm.name} onChange={e => setVariantForm({ ...variantForm, name: e.target.value })} placeholder="Brotinho, 6-pack, 1L..." className="input w-full text-sm" /></div>
                  <div><label className="text-xs text-gray-400">Descrição</label>
                    <input type="text" value={variantForm.description} onChange={e => setVariantForm({ ...variantForm, description: e.target.value })} placeholder="25cm - 4 fatias" className="input w-full text-sm" /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-xs text-gray-400">Preço *</label>
                    <input type="number" step="0.01" value={variantForm.price} onChange={e => setVariantForm({ ...variantForm, price: e.target.value })} className="input w-full text-sm" /></div>
                  <div><label className="text-xs text-gray-400">Promo</label>
                    <input type="number" step="0.01" value={variantForm.promo_price} onChange={e => setVariantForm({ ...variantForm, promo_price: e.target.value })} className="input w-full text-sm" /></div>
                  <div><label className="text-xs text-gray-400">Estoque</label>
                    <input type="number" value={variantForm.stock} onChange={e => setVariantForm({ ...variantForm, stock: e.target.value })} placeholder="Usar do produto" className="input w-full text-sm" /></div>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Código de Barras</label>
                  <input type="text" value={variantForm.barcode} onChange={e => setVariantForm({ ...variantForm, barcode: e.target.value })} className="input w-full text-sm" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={resetVariantForm} className="btn-secondary text-xs px-3 py-1.5">Cancelar</button>
                  <button onClick={handleSaveVariant} className="btn-primary text-xs px-3 py-1.5">
                    {editingVariant ? 'Atualizar' : 'Adicionar'}
                  </button>
                </div>
              </div>
            )}

            {variants.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">Nenhuma variação cadastrada. Adicione tamanhos, embalagens ou porções.</div>
            ) : (
              <div className="space-y-2">
                {variants.map(v => (
                  <div key={v.id} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                    <div>
                      <div className="font-medium text-sm text-white">{v.name}</div>
                      <div className="text-xs text-gray-400">
                        R$ {v.price.toFixed(2)}{v.promo_price ? ` (promo: R$ ${v.promo_price.toFixed(2)})` : ''}
                        {v.stock !== null ? ` · Estoque: ${v.stock}` : ''}
                        {v.description ? ` · ${v.description}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditVariant(v)} className="p-1 text-gray-400 hover:text-blue-600"><Edit size={16} /></button>
                      <button onClick={() => handleDeleteVariant(v.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-gray-500 italic">Ex: Para pizza: Brotinho R$29,90 | Médio R$39,90 | Grande R$49,90. Para Skol: Lata 350ml | 6-pack | Fardo 24.</div>
          </div>
        )}

        {/* Tab: Modificadores */}
        {tab === 'modifiers' && (
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">Modificadores / Adicionais</h3>
              <button onClick={() => { resetModifierForm(); setShowModifierForm(true); }} className="btn-primary flex items-center gap-1 text-sm px-3 py-1.5">
                <Plus size={14} /> Novo
              </button>
            </div>

            {showModifierForm && (
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-400">Nome *</label>
                    <input type="text" value={modifierForm.name} onChange={e => setModifierForm({ ...modifierForm, name: e.target.value })} placeholder="Borda, Acompanhamento..." className="input w-full text-sm" /></div>
                  <div><label className="text-xs text-gray-400">Tipo</label>
                    <select value={modifierForm.type} onChange={e => setModifierForm({ ...modifierForm, type: e.target.value as any })} className="input w-full text-sm">
                      <option value="single">Única escolha</option>
                      <option value="multiple">Múltipla escolha</option>
                      <option value="required">Obrigatório (escolha 1)</option>
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-gray-400">Mínimo</label>
                    <input type="number" value={modifierForm.min_select} onChange={e => setModifierForm({ ...modifierForm, min_select: e.target.value })} className="input w-full text-sm" /></div>
                  <div><label className="text-xs text-gray-400">Máximo</label>
                    <input type="number" value={modifierForm.max_select} onChange={e => setModifierForm({ ...modifierForm, max_select: e.target.value })} className="input w-full text-sm" /></div>
                </div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={modifierForm.creates_splits} onChange={e => setModifierForm({ ...modifierForm, creates_splits: e.target.checked })} className="rounded" />
                  <span className="text-xs text-gray-300">Cria divisão (meia-meia) — cada opção vira uma metade</span>
                </label>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={resetModifierForm} className="btn-secondary text-xs px-3 py-1.5">Cancelar</button>
                  <button onClick={handleSaveModifier} className="btn-primary text-xs px-3 py-1.5">
                    {editingModifier ? 'Atualizar' : 'Adicionar'}
                  </button>
                </div>
              </div>
            )}

            {modifiers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">Nenhum modificador cadastrado. Adicione bordas, acompanhamentos, etc.</div>
            ) : (
              <div className="space-y-2">
                {modifiers.map(m => (
                  <div key={m.id} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-white">{m.name}</div>
                        <div className="text-xs text-gray-400">
                          {m.type === 'single' ? 'Única escolha' : m.type === 'multiple' ? 'Múltipla' : 'Obrigatório'}
                          {m.creates_splits ? ' · 🍕 Divide sabores' : ''}
                          {m.options?.length ? ` · ${m.options.length} opção(ões)` : ' · sem opções'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setSelectedModifier(selectedModifier?.id === m.id ? null : m); setShowOptionForm(false); }} className="p-1 text-gray-400 hover:text-green-600" title="Gerenciar opções">
                          <Package size={16} />
                        </button>
                        <button onClick={() => openEditModifier(m)} className="p-1 text-gray-400 hover:text-blue-600"><Edit size={16} /></button>
                        <button onClick={() => handleDeleteModifier(m.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    {/* Options sub-section */}
                    {selectedModifier?.id === m.id && (
                      <div className="mt-3 pl-4 border-l-2 border-primary-600 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-300">Opções de "{m.name}"</span>
                          <button onClick={() => { resetOptionForm(); setShowOptionForm(true); }} className="text-xs text-primary-600 hover:text-primary-500 flex items-center gap-1">
                            <Plus size={12} /> Opção
                          </button>
                        </div>

                        {showOptionForm && (
                          <div className="bg-gray-900 rounded p-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className="text-xs text-gray-400">Nome *</label>
                                <input type="text" value={optionForm.name} onChange={e => setOptionForm({ ...optionForm, name: e.target.value })} placeholder="Catupiry, Cheddar..." className="input w-full text-xs" /></div>
                              <div><label className="text-xs text-gray-400">Acréscimo R$</label>
                                <input type="number" step="0.01" value={optionForm.price_add} onChange={e => setOptionForm({ ...optionForm, price_add: e.target.value })} className="input w-full text-xs" placeholder="0,00" /></div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button onClick={resetOptionForm} className="btn-secondary text-xs px-2 py-1">Cancelar</button>
                              <button onClick={handleSaveOption} className="btn-primary text-xs px-2 py-1">
                                {editingOption ? 'Atualizar' : 'Adicionar'}
                              </button>
                            </div>
                          </div>
                        )}

                        {(!m.options || m.options.length === 0) ? (
                          <div className="text-xs text-gray-600 italic">Nenhuma opção. Clique no + acima para adicionar.</div>
                        ) : (
                          m.options.map(o => (
                            <div key={o.id} className="flex items-center justify-between bg-gray-900 rounded px-2 py-1.5">
                              <div className="text-xs text-gray-300">{o.name}</div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{o.price_add > 0 ? `+R$ ${o.price_add.toFixed(2)}` : 'Grátis'}</span>
                                <button onClick={() => openEditOption(o)} className="text-gray-500 hover:text-blue-600"><Edit size={12} /></button>
                                <button onClick={() => handleDeleteOption(o.id)} className="text-gray-500 hover:text-red-600"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-gray-500 italic">Ex: "Borda" com opções Catupiry (+R$4) e Cheddar (+R$4). "Acompanhamento" (obrigatório) com Arroz, Fritas ou Salada.</div>
          </div>
        )}
      </div>
    </div>
  );
}
