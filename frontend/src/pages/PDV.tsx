import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { productsApi, categoriesApi } from '../api/products';
import { ordersApi } from '../api/orders';
import { cashRegisterApi } from '../api/cash-register';
import api from '../api/client';
import { Product, Category } from '../types';
import { formatCurrency } from '../utils/format';
import { Search, Plus, Minus, Trash2, ShoppingCart, X, CreditCard, Banknote, Smartphone, Wallet, ScanBarcode, Package, Users, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import CashRegisterModal from '../components/cash-register/CashRegisterModal';

interface SplitGroup {
  id: string;
  label: string;
  paymentMethod: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  splitId: string;
  variant_id?: string;
  variant_name?: string;
  modifiers?: Array<{ modifier_id: string; option_id: string; option_name: string; price_add: number }>;
  display_name?: string;
  unit_price: number;
}

interface PersonSplit {
  label: string;
  paymentMethod: string;
  quantities: Record<string, number>;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
  { value: 'credit_card', label: 'Crédito', icon: CreditCard },
  { value: 'debit_card', label: 'Débito', icon: CreditCard },
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'voucher', label: 'Vale', icon: Wallet },
];

let splitIdCounter = 0;
function nextSplitId() {
  return `split_${++splitIdCounter}`;
}

export default function PDV() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [singlePaymentMethod, setSinglePaymentMethod] = useState<string>('cash');
  const [splitMode, setSplitMode] = useState(false);
  const [splitGroups, setSplitGroups] = useState<SplitGroup[]>([]);
  const [cashRegisterOpen, setCashRegisterOpen] = useState<boolean>(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Split modal state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [numPeople, setNumPeople] = useState(2);
  const [people, setPeople] = useState<PersonSplit[]>([]);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Product configuration modal state (variants + modifiers)
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [configVariant, setConfigVariant] = useState<string>('');
  const [configModifiers, setConfigModifiers] = useState<Record<string, string[]>>({});
  const [configHalves, setConfigHalves] = useState(false);

  // Custom sale state
  const [allowCustomSale, setAllowCustomSale] = useState(false);
  const [customPrice, setCustomPrice] = useState('');

  useEffect(() => {
    loadData();
    checkCashRegister();
    loadSettings();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        openSearch();
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const loadData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        productsApi.getCatalog(),
        categoriesApi.getAll(),
      ]);
      const allProducts = prodRes.data.data.flatMap((g: any) => g.products || []);
      setProducts(allProducts);
      setCategories(catRes.data.data);
    } catch {
      toast.error('Erro ao carregar produtos');
    }
  };

  const checkCashRegister = async () => {
    try {
      const { data } = await cashRegisterApi.getCurrent();
      setCashRegisterOpen(!!data.data);
    } catch {
      setCashRegisterOpen(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/settings/allow_sale_without_product');
      setAllowCustomSale(data.data === 'true');
    } catch {
      setAllowCustomSale(false);
    }
  };

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery('');
    setSearchResults([]);
    setCustomPrice('');
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const normalizeText = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      const q = normalizeText(query.trim());
      const localResults = products.filter(p =>
        normalizeText(p.name).includes(q) ||
        normalizeText(p.brand || '').includes(q) ||
        (p.barcode || '').includes(query.trim()) ||
        normalizeText(p.description || '').includes(q)
      ).slice(0, 20);
      setSearchResults(localResults);
    }, 150);
  }, [products]);

  const handleSearchBarcode = async (barcode: string) => {
    if (!barcode.trim()) return;
    setSearchLoading(true);
    try {
      const result = await productsApi.searchByBarcode(barcode.trim());
      if (result.found && result.source === 'local') {
        addToCart(result.product);
        setSearchOpen(false);
        setSearchQuery('');
        return;
      }
      if (result.found && result.source === 'api') {
        toast(`${result.product.name} - não cadastrado.`, { icon: '📋' });
      } else {
        toast.error(result.error || 'Produto não encontrado');
      }
    } catch {
      toast.error('Erro ao buscar código de barras');
    } finally {
      setSearchLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    const hasVariants = product.variants && product.variants.length > 0;
    const requiredModifiers = (product.modifiers || []).filter(m => m.type === 'required' || m.min_select > 0);
    const hasRequiredModifiers = requiredModifiers.length > 0;

    if (hasVariants || hasRequiredModifiers) {
      setConfigProduct(product);
      setConfigVariant(product.variants?.[0]?.id || '');
      const initialMods: Record<string, string[]> = {};
      for (const mod of requiredModifiers) {
        initialMods[mod.id] = [];
      }
      setConfigModifiers(initialMods);
      setConfigHalves(false);
      return;
    }

    const basePrice = product.promo_price ?? product.price;
    const avail = availableStock(product);
    if (avail <= 0) {
      toast(`${product.name} - sem estoque disponível!`, { icon: '⚠️' });
    }
    const splitId = '_single';
    setCart(prev => {
      const existing = prev.find(i =>
        i.product.id === product.id && i.splitId === splitId && !i.variant_id && (!i.modifiers || i.modifiers.length === 0)
      );
      if (existing) {
        return prev.map(i =>
          i === existing ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1, splitId, unit_price: basePrice }];
    });
    toast.success(`${product.name} adicionado`);
  };

  const getConfiguredPrice = (product: Product, variantId: string, modifiers: Record<string, string[]>): number => {
    let price = product.price;
    if (variantId) {
      const variant = product.variants?.find(v => v.id === variantId);
      if (variant) price = variant.promo_price ?? variant.price;
    }
    for (const mod of (product.modifiers || [])) {
      const selected = modifiers[mod.id] || [];
      for (const optId of selected) {
        const opt = mod.options?.find(o => o.id === optId);
        if (opt) price += opt.price_add;
      }
    }
    return price;
  };

  const confirmConfigAddToCart = () => {
    if (!configProduct) return;
    const product = configProduct;

    const requiredMods = (product.modifiers || []).filter(m => m.type === 'required' || m.min_select > 0);
    for (const mod of requiredMods) {
      const selected = configModifiers[mod.id] || [];
      if (selected.length < mod.min_select) {
        toast.error(`Selecione pelo menos ${mod.min_select} opção(ões) de "${mod.name}"`);
        return;
      }
    }

    const allModifiers: Array<{ modifier_id: string; option_id: string; option_name: string; price_add: number }> = [];
    for (const mod of (product.modifiers || [])) {
      const selected = configModifiers[mod.id] || [];
      for (const optId of selected) {
        const opt = mod.options?.find(o => o.id === optId);
        if (opt) {
          allModifiers.push({
            modifier_id: mod.id,
            option_id: opt.id,
            option_name: opt.name,
            price_add: opt.price_add,
          });
        }
      }
    }

    const unitPrice = getConfiguredPrice(product, configVariant, configModifiers);
    const variantObj = configVariant ? product.variants?.find(v => v.id === configVariant) : undefined;
    const modNames = allModifiers.map(m => m.option_name).join(' + ');
    const variantName = variantObj?.name || '';
    const displayName = [product.name, variantName, modNames].filter(Boolean).join(' ');

    const avail = availableStock(product);
    if (avail <= 0) {
      toast(`${product.name} - sem estoque disponível!`, { icon: '⚠️' });
    }

    const splitId = '_single';
    setCart(prev => [
      ...prev,
      {
        product,
        quantity: 1,
        splitId,
        variant_id: configVariant || undefined,
        variant_name: variantName || undefined,
        modifiers: allModifiers.length > 0 ? allModifiers : undefined,
        display_name: displayName !== product.name ? displayName : undefined,
        unit_price: unitPrice,
      },
    ]);

    setConfigProduct(null);
    setConfigVariant('');
    setConfigModifiers({});
    setConfigHalves(false);
    toast.success(`${displayName} adicionado`);
  };

  const addCustomToCart = (name: string, price: number) => {
    const customProduct: Product = {
      id: `custom_${Date.now()}`,
      category_id: '',
      name,
      slug: '',
      description: null,
      price,
      promo_price: null,
      cost_price: null,
      image_url: null,
      barcode: null,
      stock: 999,
      unit: 'un',
      volume: null,
      brand: null,
      is_active: 1,
      is_featured: 0,
    };
    addToCart(customProduct);
  };

  const updateQuantity = (cartIdx: number, delta: number) => {
    setCart(prev => prev.map((item, idx) => {
      if (idx !== cartIdx || item.splitId !== '_single') return item;
      const newQty = item.quantity + delta;
      return newQty <= 0 ? item : { ...item, quantity: newQty };
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (cartIdx: number) => {
    setCart(prev => prev.filter((_, idx) => idx !== cartIdx));
  };

  const clearCart = () => {
    setCart([]);
    setSplitMode(false);
    setSplitGroups([]);
  };

  const subtotal = useMemo(() =>
    cart.reduce((sum, i) => {
      return sum + i.unit_price * i.quantity;
    }, 0),
    [cart]
  );

  const totalItems = useMemo(() => cart.reduce((sum, i) => sum + i.quantity, 0), [cart]);

  function availableStock(product: Product): number {
    const base = product.stock ?? 999;
    const inCart = cart.filter(i => i.product.id === product.id).reduce((sum, i) => sum + i.quantity, 0);
    return base - inCart;
  }

  // Merge same products by product.id + variant_id + modifiers key in split mode display
  const cartSummary = useMemo(() => {
    const map = new Map<string, CartItem & { cartIndices: number[] }>();
    for (let idx = 0; idx < cart.length; idx++) {
      const i = cart[idx];
      const modKey = (i.modifiers || []).map(m => m.option_id).sort().join(',');
      const k = `${i.product.id}_${i.variant_id || ''}_${modKey}`;
      if (map.has(k)) {
        const existing = map.get(k)!;
        existing.quantity += i.quantity;
        existing.cartIndices.push(idx);
      } else {
        map.set(k, { ...i, cartIndices: [idx] });
      }
    }
    return Array.from(map.values());
  }, [cart]);

  // --- Split Modal ---

  function openSplitModal() {
    const initialPeople: PersonSplit[] = [];
    for (let i = 0; i < numPeople; i++) {
      initialPeople.push({
        label: `Pessoa ${i + 1}`,
        paymentMethod: i === 0 ? singlePaymentMethod : 'cash',
        quantities: {},
      });
    }
    setPeople(initialPeople);
    setShowSplitModal(true);
  }

  function handleNumPeopleChange(n: number) {
    const count = Math.max(2, Math.min(10, n));
    setNumPeople(count);
    setPeople(prev => {
      const updated = [...prev];
      while (updated.length < count) {
        updated.push({
          label: `Pessoa ${updated.length + 1}`,
          paymentMethod: 'cash',
          quantities: {},
        });
      }
      return updated.slice(0, count);
    });
  }

  function updatePersonLabel(idx: number, label: string) {
    setPeople(prev => prev.map((p, i) => i === idx ? { ...p, label } : p));
  }

  function updatePersonPayment(idx: number, pm: string) {
    setPeople(prev => prev.map((p, i) => i === idx ? { ...p, paymentMethod: pm } : p));
  }

  function updatePersonQuantity(personIdx: number, productId: string, value: number) {
    const cartItem = cartSummary.find(i => i.product.id === productId);
    if (!cartItem) return;
    const max = cartItem.quantity;
    const clamped = Math.max(0, Math.min(max, value || 0));
    setPeople(prev => prev.map((p, i) => {
      if (i !== personIdx) return p;
      return { ...p, quantities: { ...p.quantities, [productId]: clamped } };
    }));
  }

  function getRemainingQuantity(productId: string): number {
    const cartItem = cartSummary.find(i => i.product.id === productId);
    if (!cartItem) return 0;
    const assigned = people.reduce((sum, p) => sum + (p.quantities[productId] || 0), 0);
    return cartItem.quantity - assigned;
  }

  function getPersonTotal(person: PersonSplit): number {
    return Object.entries(person.quantities).reduce((sum, [pid, qty]) => {
      const item = cartSummary.find(i => i.product.id === pid);
      if (!item) return sum;
      return sum + item.unit_price * qty;
    }, 0);
  }

  function confirmSplit() {
    // Validate: all items must be fully assigned
    for (const item of cartSummary) {
      const assigned = people.reduce((sum, p) => sum + (p.quantities[item.product.id] || 0), 0);
      if (assigned !== item.quantity) {
        toast.error(`${item.product.name}: distribua todas as ${item.quantity} unidades entre as pessoas`);
        return;
      }
    }

    const emptyPeople = people.filter(p => {
      const total = Object.values(p.quantities).reduce((s, q) => s + q, 0);
      return total === 0;
    });
    if (emptyPeople.length > 0) {
      toast.error(`Remova pessoas sem itens: ${emptyPeople.map(p => p.label).join(', ')}`);
      return;
    }

    // Build split groups and rebuild cart
    const groups: SplitGroup[] = people.map(p => ({
      id: nextSplitId(),
      label: p.label,
      paymentMethod: p.paymentMethod,
    }));

    const newCart: CartItem[] = [];
    for (const item of cartSummary) {
      for (let pi = 0; pi < people.length; pi++) {
        const qty = people[pi].quantities[item.product.id] || 0;
        if (qty > 0) {
          newCart.push({
            product: item.product,
            quantity: qty,
            splitId: groups[pi].id,
            variant_id: item.variant_id,
            variant_name: item.variant_name,
            modifiers: item.modifiers,
            display_name: item.display_name,
            unit_price: item.unit_price,
          });
        }
      }
    }

    setSplitGroups(groups);
    setCart(newCart);
    setSplitMode(true);
    setShowSplitModal(false);
  }

  const splitsTotal = useMemo(() => {
    if (!splitMode) return {};
    const totals: Record<string, number> = {};
    for (const g of splitGroups) {
      totals[g.id] = cart
        .filter(i => i.splitId === g.id)
        .reduce((sum, i) => {
          return sum + i.unit_price * i.quantity;
        }, 0);
    }
    return totals;
  }, [cart, splitGroups, splitMode]);

  const handleFinishSale = async () => {
    if (!cashRegisterOpen) return toast.error('Abra o caixa antes de finalizar a venda');
    if (cart.length === 0) return toast.error('Adicione itens ao carrinho');

    if (splitMode) {
      const unassigned = cart.filter(i => !splitGroups.some(g => g.id === i.splitId));
      if (unassigned.length > 0) {
        return toast.error('Todos os itens devem ser atribuídos a uma pessoa');
      }
    }

    setLoading(true);
    try {
      const items = cart.map(i => {
        if (i.product.id.startsWith('custom_')) {
          return { product_id: '', product_name: i.product.name, unit_price: i.unit_price, quantity: i.quantity };
        }
        const item: any = { product_id: i.product.id, quantity: i.quantity };
        if (i.variant_id) item.variant_id = i.variant_id;
        if (i.modifiers && i.modifiers.length > 0) item.modifiers = i.modifiers;
        return item;
      });

      let paymentMethod: string | undefined;
      let paymentSplits: Array<{ label: string; product_ids: string[]; payment_method: string; total: number }> | undefined;

      if (splitMode) {
        paymentSplits = splitGroups.map(g => {
          const groupItems = cart.filter(i => i.splitId === g.id);
          return {
            label: g.label,
            product_ids: groupItems.flatMap(i => Array(i.quantity).fill(i.product.id)),
            payment_method: g.paymentMethod,
            total: splitsTotal[g.id] || 0,
          };
        });
      } else {
        paymentMethod = singlePaymentMethod;
      }

      const { data } = await ordersApi.create({
        customer_id: 'pdv-walk-in',
        items,
        payment_method: paymentMethod,
        payment_splits: paymentSplits,
        order_type: 'pdv',
        notes: 'Venda PDV - Balcão',
      });
      setLastOrderNumber(data.data.order_number);
      setShowSuccess(true);
      clearCart();
      loadData(); // refresh stock from DB
      checkCashRegister();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao finalizar venda');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">PDV</h1>
          <span className="text-sm text-gray-400">Ponto de Venda</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCashModal(true)}
            className={`btn-secondary flex items-center gap-2 text-sm ${cashRegisterOpen ? 'text-green-600' : 'text-red-600'}`}
          >
            <Wallet size={16} />
            {cashRegisterOpen ? 'Caixa Aberto' : 'Caixa Fechado'}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchOpen ? searchQuery : ''}
              onFocus={openSearch}
              onChange={e => handleSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  if (/^\d+$/.test(searchQuery.trim())) {
                    handleSearchBarcode(searchQuery.trim());
                  }
                }
              }}
              placeholder="Buscar produto por nome, marca ou código de barras... (F2)"
              className="w-full pl-12 pr-4 py-3 text-lg bg-gray-900 border-2 border-gray-800 rounded-xl focus:border-primary-500 focus:outline-none transition-colors"
            />
            {searchOpen && (
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-400"
              >
                <X size={20} />
              </button>
            )}
          </div>
          <button
            onClick={() => {
              if (searchQuery.trim() && /^\d+$/.test(searchQuery.trim())) {
                handleSearchBarcode(searchQuery.trim());
              } else {
                openSearch();
              }
            }}
            disabled={searchLoading}
            className="btn-primary px-6 flex items-center gap-2 text-lg disabled:opacity-50"
          >
            <ScanBarcode size={20} />
            {searchLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {searchOpen && searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 rounded-xl shadow-2xl border border-gray-800 z-50 max-h-[60vh] overflow-y-auto">
            {searchResults.length > 0 ? (
              <div className="p-2">
                <p className="text-xs text-gray-400 px-3 py-1">{searchResults.length} produto(s) encontrado(s)</p>
                {searchResults.map(product => {
                  const price = (product.promo_price != null && product.promo_price > 0) ? product.promo_price : product.price;
                  const inCart = cart.find(i => i.product.id === product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => {
                        addToCart(product);
                        setSearchQuery('');
                        setSearchOpen(false);
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-primary-50 transition-colors text-left"
                    >
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover bg-gray-800" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-lg font-bold text-gray-400">
                          {product.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{product.name}</p>
                        <p className="text-sm text-gray-400">
                          {product.brand && `${product.brand} · `}
                          {product.barcode && `${product.barcode} · `}
                          Estoque: {availableStock(product)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-600">{formatCurrency(price)}</p>
                        {inCart && (
                          <p className="text-xs text-primary-500">{inCart.quantity}x no carrinho</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">
                <Package size={32} className="mx-auto mb-2 opacity-50" />
                <p>Nenhum produto encontrado para "{searchQuery}"</p>
                <p className="text-sm mt-1">Tente outro termo ou escaneie o código de barras</p>
                {allowCustomSale && (
                  <div className="mt-6 pt-6 border-t border-gray-800 text-left max-w-sm mx-auto">
                    <p className="text-sm font-medium text-gray-300 mb-3 text-center">Adicionar item avulso</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Nome do item</label>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="input w-full text-sm"
                          placeholder="Ex: Água, Salgado, etc"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Valor (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customPrice}
                          onChange={e => setCustomPrice(e.target.value)}
                          className="input w-full text-sm"
                          placeholder="0,00"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const price = parseFloat(customPrice) || 0;
                          if (price <= 0) {
                            toast.error('Informe um valor válido');
                            return;
                          }
                          addCustomToCart(searchQuery.trim() || 'Item avulso', price);
                          setSearchOpen(false);
                          setSearchQuery('');
                          setCustomPrice('');
                        }}
                        className="btn-primary w-full flex items-center justify-center gap-2 py-2 text-sm"
                      >
                        <DollarSign size={16} />
                        Adicionar ao carrinho
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content: Cart */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-gray-400" />
            <h2 className="text-lg font-bold text-gray-200">Carrinho</h2>
            {cart.length > 0 && (
              <span className="bg-primary-100 text-primary-700 text-sm font-medium px-2 py-0.5 rounded-full">
                {totalItems} {totalItems === 1 ? 'item' : 'itens'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {splitMode && (
              <button
                onClick={() => { setSplitMode(false); setSplitGroups([]); setCart(prev => prev.map(i => ({ ...i, splitId: '_single' }))); }}
                className="text-sm text-gray-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:text-gray-200"
              >
                <X size={14} /> Cancelar divisão
              </button>
            )}
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
                <Trash2 size={14} /> Limpar carrinho
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 bg-gray-900 rounded-xl border overflow-hidden flex flex-col">
          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <ShoppingCart size={64} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg">Carrinho vazio</p>
                <p className="text-sm mt-1">Busque um produto acima ou escaneie o código de barras</p>
                <button onClick={openSearch} className="btn-primary mt-4 px-6 py-2">
                  Buscar produto
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Produto</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-400 w-32">Preço</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-400 w-40">Quantidade</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-400 w-32">Total</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {cartSummary.map(item => {
                    const price = item.unit_price;
                    const displayName = item.display_name || item.product.name;
                    return (
                      <tr key={`${item.product.id}_${item.variant_id}_${(item.modifiers || []).map(m => m.option_id).join(',')}`} className="hover:bg-gray-800/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.product.image_url ? (
                              <img src={item.product.image_url} alt={item.product.name} className="w-10 h-10 rounded-lg object-cover bg-gray-800" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-400">
                                {item.product.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-white">{displayName}</p>
                              {item.product.brand && <p className="text-xs text-gray-400">{item.product.brand}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-400">
                          {formatCurrency(price)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                const idx = item.cartIndices?.[0] ?? 0;
                                updateQuantity(idx, -1);
                              }}
                              className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-200 flex items-center justify-center transition-colors"
                            >
                              <Minus size={16} />
                            </button>
                            <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                            <button
                              onClick={() => {
                                const idx = item.cartIndices?.[0] ?? 0;
                                updateQuantity(idx, 1);
                              }}
                              className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-200 flex items-center justify-center transition-colors"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-white">
                          {formatCurrency(price * item.quantity)}
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => {
                              const idx = item.cartIndices?.[0] ?? 0;
                              removeFromCart(idx);
                            }}
                            className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Split Mode: show group cards */}
        {splitMode && splitGroups.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {splitGroups.map(g => {
              const groupItems = cart.filter(i => i.splitId === g.id);
              const groupTotal = groupItems.reduce((sum, i) => {
                return sum + i.unit_price * i.quantity;
              }, 0);
              return (
                <div key={g.id} className="bg-gray-900 rounded-xl border border-primary-700 p-4 space-y-2">
                  <p className="font-bold text-white text-sm">{g.label}</p>
                  <div className="text-xs text-gray-400 space-y-1">
                    {groupItems.map((i, idx) => {
                      const displayName = i.display_name || i.product.name;
                      return (
                        <div key={idx} className="flex justify-between">
                          <span>{i.quantity}x {displayName}</span>
                          <span>{formatCurrency(i.unit_price * i.quantity)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-gray-800">
                    <span className="text-xs text-gray-400">
                      {PAYMENT_METHODS.find(p => p.value === g.paymentMethod)?.label || g.paymentMethod}
                    </span>
                    <span className="text-lg font-bold text-primary-600">{formatCurrency(groupTotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom: Payment + Total */}
        {cart.length > 0 && (
          <div className="mt-4 bg-gray-900 rounded-xl border p-4">
            {splitMode ? (
              <div className="flex items-center justify-between gap-6">
                <div className="text-sm text-gray-400">
                  {splitGroups.length} divisão(ões)
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Total Geral</p>
                    <p className="text-3xl font-bold text-primary-600">{formatCurrency(subtotal)}</p>
                  </div>
                  <button
                    onClick={handleFinishSale}
                    disabled={loading}
                    className="btn-primary px-8 py-4 text-lg font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Finalizando...' : 'Finalizar Venda'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-400 mb-2">Forma de Pagamento</p>
                  <div className="flex gap-2">
                    {PAYMENT_METHODS.map(pm => (
                      <button
                        key={pm.value}
                        onClick={() => setSinglePaymentMethod(pm.value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          singlePaymentMethod === pm.value
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        <pm.icon size={16} />
                        {pm.label}
                      </button>
                    ))}
                    <button
                      onClick={openSplitModal}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-primary-600 hover:bg-primary-50 transition-colors"
                    >
                      <Users size={16} /> Dividir
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Total</p>
                    <p className="text-3xl font-bold text-primary-600">{formatCurrency(subtotal)}</p>
                  </div>
                  <button
                    onClick={handleFinishSale}
                    disabled={loading}
                    className="btn-primary px-8 py-4 text-lg font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Finalizando...' : 'Finalizar Venda'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cash Register Modal */}
      {showCashModal && (
        <CashRegisterModal
          onClose={() => setShowCashModal(false)}
          onStatusChange={checkCashRegister}
        />
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Venda Finalizada!</h3>
            {lastOrderNumber && <p className="text-gray-400 mb-6">Pedido #{lastOrderNumber}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowSuccess(false); openSearch(); }}
                className="btn-primary flex-1 py-3"
              >
                Nova Venda
              </button>
              <button
                onClick={() => setShowSuccess(false)}
                className="btn-secondary flex-1 py-3"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Modal */}
      {showSplitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Dividir Pagamento</h3>
                <button onClick={() => setShowSplitModal(false)} className="text-gray-400 hover:text-gray-200">
                  <X size={20} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-400 whitespace-nowrap">Quantas pessoas?</label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={numPeople}
                  onChange={e => handleNumPeopleChange(parseInt(e.target.value) || 2)}
                  className="w-20 bg-gray-800 text-white text-lg font-bold text-center rounded-lg px-3 py-2 border border-gray-700 focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Body: product grid + person columns */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {people.map((person, pi) => (
                  <div key={pi} className="bg-gray-800/50 rounded-xl p-4 border border-gray-800">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <input
                        type="text"
                        value={person.label}
                        onChange={e => updatePersonLabel(pi, e.target.value)}
                        className="bg-transparent text-white font-bold text-sm border-b border-dashed border-gray-700 focus:border-primary-500 focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Pagamento:</span>
                        <select
                          value={person.paymentMethod}
                          onChange={e => updatePersonPayment(pi, e.target.value)}
                          className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:border-primary-500 focus:outline-none"
                        >
                          {PAYMENT_METHODS.map(pm => (
                            <option key={pm.value} value={pm.value}>{pm.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {cartSummary.map(item => {
                        const qty = person.quantities[item.product.id] || 0;
                        const remaining = getRemainingQuantity(item.product.id) + qty;
                        const price = item.unit_price;
                        const displayName = item.display_name || item.product.name;
                        return (
                          <div key={`${item.product.id}_${item.variant_id}`} className="flex items-center gap-3">
                            <span className="text-sm text-gray-300 flex-1 min-w-0 truncate">{displayName}</span>
                            <span className="text-xs text-gray-500 w-16 text-right">disp: {remaining}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updatePersonQuantity(pi, item.product.id, Math.max(0, qty - 1))}
                                className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-200 flex items-center justify-center text-sm"
                                disabled={qty <= 0}
                              >
                                <Minus size={12} />
                              </button>
                              <span className="w-14 text-center text-white text-sm font-bold">{qty}</span>
                              <button
                                onClick={() => updatePersonQuantity(pi, item.product.id, Math.min(remaining, qty + 1))}
                                className="w-7 h-7 rounded bg-gray-800 hover:bg-gray-200 flex items-center justify-center text-sm"
                                disabled={qty >= remaining}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-primary-600 w-20 text-right">
                              {qty > 0 ? formatCurrency(price * qty) : '-'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-700 text-right">
                      <span className="text-sm text-gray-400">Subtotal: </span>
                      <span className="text-lg font-bold text-primary-600">{formatCurrency(getPersonTotal(person))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-4 border-t border-gray-800 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Total: <strong className="text-white">{formatCurrency(subtotal)}</strong>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowSplitModal(false)} className="btn-secondary px-6 py-2">
                  Cancelar
                </button>
                <button onClick={confirmSplit} className="btn-primary px-6 py-2">
                  Confirmar Divisão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Configuration Modal (Variants + Modifiers) */}
      {configProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 pb-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-white">{configProduct.name}</h3>
                <button onClick={() => setConfigProduct(null)} className="text-gray-400 hover:text-gray-200">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-400">Configure o item antes de adicionar ao carrinho</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Variant Selection */}
              {configProduct.variants && configProduct.variants.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-300 mb-3">Tamanho</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {configProduct.variants.filter(v => v.is_active).map(variant => {
                      const price = variant.promo_price ?? variant.price;
                      return (
                        <button
                          key={variant.id}
                          onClick={() => setConfigVariant(variant.id)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            configVariant === variant.id
                              ? 'border-primary-500 bg-primary-500/10'
                              : 'border-gray-700 hover:border-gray-500'
                          }`}
                        >
                          <p className="font-bold text-white text-sm">{variant.name}</p>
                          <p className="text-primary-500 font-bold">{formatCurrency(price)}</p>
                          {variant.stock !== null && (
                            <p className="text-xs text-gray-500">Estoque: {variant.stock}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modifier Selection */}
              {(configProduct.modifiers || []).map(mod => (
                <div key={mod.id}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-gray-300">{mod.name}</h4>
                    <span className="text-xs text-gray-500">
                      {mod.min_select > 0 && `Mín: ${mod.min_select}`}
                      {mod.max_select > 1 && ` | Máx: ${mod.max_select}`}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(mod.options || []).filter(o => o.is_active).map(option => {
                      const selected = (configModifiers[mod.id] || []).includes(option.id);
                      return (
                        <button
                          key={option.id}
                          onClick={() => {
                            setConfigModifiers(prev => {
                              const current = prev[mod.id] || [];
                              if (mod.max_select <= 1) {
                                return { ...prev, [mod.id]: [option.id] };
                              }
                              if (selected) {
                                return { ...prev, [mod.id]: current.filter(id => id !== option.id) };
                              }
                              if (current.length >= mod.max_select) {
                                toast.error(`Máximo de ${mod.max_select} opções`);
                                return prev;
                              }
                              return { ...prev, [mod.id]: [...current, option.id] };
                            });
                          }}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                            selected
                              ? 'border-primary-500 bg-primary-500/10'
                              : 'border-gray-700 hover:border-gray-500'
                          }`}
                        >
                          <span className="text-sm text-white">{option.name}</span>
                          {option.price_add > 0 && (
                            <span className="text-xs text-primary-500 font-bold">+{formatCurrency(option.price_add)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 pt-4 border-t border-gray-800">
              {/* Price Preview */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">Preço unitário:</span>
                <span className="text-lg font-bold text-primary-600">
                  {formatCurrency(getConfiguredPrice(configProduct, configVariant, configModifiers))}
                </span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfigProduct(null)} className="btn-secondary px-6 py-2 flex-1">
                  Cancelar
                </button>
                <button onClick={confirmConfigAddToCart} className="btn-primary px-6 py-2 flex-1">
                  Adicionar ao Carrinho
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
