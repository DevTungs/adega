import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { productsApi, categoriesApi } from '../api/products';
import { ordersApi } from '../api/orders';
import { cashRegisterApi } from '../api/cash-register';
import { Product, Category } from '../types';
import { formatCurrency } from '../utils/format';
import { Search, Plus, Minus, Trash2, ShoppingCart, X, CreditCard, Banknote, Smartphone, Wallet, ScanBarcode, Package, Users, UserPlus, ChevronDown } from 'lucide-react';
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

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadData();
    checkCashRegister();
  }, []);

  // F2 to focus search
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

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery('');
    setSearchResults([]);
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
        toast(`${result.product.name} - não cadastrado. Cadastre em Produtos.`, { icon: '📋' });
      } else {
        toast.error(result.error || 'Produto não encontrado');
      }
    } catch {
      toast.error('Erro ao buscar código de barras');
    } finally {
      setSearchLoading(false);
    }
  };

  function ensureDefaultSplit() {
    setSplitGroups(prev => {
      if (prev.length > 0) return prev;
      return [{ id: nextSplitId(), label: 'Pessoa 1', paymentMethod: 'cash' }];
    });
  }

  function getDefaultSplitId(): string {
    if (splitGroups.length > 0) return splitGroups[0].id;
    const id = nextSplitId();
    setSplitGroups([{ id, label: 'Pessoa 1', paymentMethod: 'cash' }]);
    return id;
  }

  const addToCart = (product: Product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      toast.error('Produto sem estoque');
      return;
    }
    const splitId = splitMode ? getDefaultSplitId() : '_single';
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.splitId === splitId);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id && i.splitId === splitId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1, splitId }];
    });
    toast.success(`${product.name} adicionado`);
  };

  const updateQuantity = (productId: string, splitId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId || i.splitId !== splitId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (productId: string, splitId: string) => {
    setCart(prev => prev.filter(i => !(i.product.id === productId && i.splitId === splitId)));
  };

  const clearCart = () => {
    setCart([]);
    setSplitMode(false);
    setSplitGroups([]);
  };

  const subtotal = useMemo(() =>
    cart.reduce((sum, i) => {
      const price = i.product.promo_price ?? i.product.price;
      return sum + price * i.quantity;
    }, 0),
    [cart]
  );

  const totalItems = useMemo(() => cart.reduce((sum, i) => sum + i.quantity, 0), [cart]);

  function enableSplitMode() {
    if (splitMode) return;
    const groups: SplitGroup[] = [{ id: nextSplitId(), label: 'Pessoa 1', paymentMethod: singlePaymentMethod }];
    setSplitGroups(groups);
    setCart(prev => prev.map(i => ({ ...i, splitId: groups[0].id })));
    setSplitMode(true);
  }

  function disableSplitMode() {
    setSplitGroups([]);
    setCart(prev => {
      if (prev.length === 0) return prev;
      return prev.map(i => ({ ...i, splitId: '_single' }));
    });
    setSplitMode(false);
  }

  function addSplitGroup() {
    const newGroup: SplitGroup = { id: nextSplitId(), label: `Pessoa ${splitGroups.length + 1}`, paymentMethod: 'cash' };
    setSplitGroups(prev => [...prev, newGroup]);
  }

  function removeSplitGroup(id: string) {
    setSplitGroups(prev => {
      const remaining = prev.filter(g => g.id !== id);
      if (remaining.length === 0) {
        disableSplitMode();
        return [];
      }
      // Reassign orphaned items to first remaining split
      setCart(c => c.map(i => i.splitId === id ? { ...i, splitId: remaining[0].id } : i));
      return remaining;
    });
  }

  function updateSplitLabel(id: string, label: string) {
    setSplitGroups(prev => prev.map(g => g.id === id ? { ...g, label } : g));
  }

  function updateSplitPayment(id: string, paymentMethod: string) {
    setSplitGroups(prev => prev.map(g => g.id === id ? { ...g, paymentMethod } : g));
  }

  function assignItemToSplit(productId: string, oldSplitId: string, newSplitId: string) {
    setCart(prev => prev.map(i =>
      i.product.id === productId && i.splitId === oldSplitId ? { ...i, splitId: newSplitId } : i
    ));
  }

  const splitsTotal = useMemo(() => {
    if (!splitMode) return {};
    const totals: Record<string, number> = {};
    for (const g of splitGroups) {
      totals[g.id] = cart
        .filter(i => i.splitId === g.id)
        .reduce((sum, i) => {
          const price = i.product.promo_price ?? i.product.price;
          return sum + price * i.quantity;
        }, 0);
    }
    return totals;
  }, [cart, splitGroups, splitMode]);

  const handleFinishSale = async () => {
    if (cart.length === 0) return toast.error('Adicione itens ao carrinho');

    if (splitMode) {
      const unassigned = cart.filter(i => !splitGroups.some(g => g.id === i.splitId));
      if (unassigned.length > 0) {
        return toast.error('Todos os itens devem ser atribuídos a uma pessoa');
      }
      const emptyGroups = splitGroups.filter(g => !cart.some(i => i.splitId === g.id));
      if (emptyGroups.length > 0) {
        return toast.error(`Remova divisões vazias: ${emptyGroups.map(g => g.label).join(', ')}`);
      }
    }

    setLoading(true);
    try {
      const items = cart.map(i => ({ product_id: i.product.id, quantity: i.quantity }));

      let paymentMethod: string | undefined;
      let paymentSplits: Array<{ label: string; product_ids: string[]; payment_method: string; total: number }> | undefined;

      if (splitMode) {
        paymentSplits = splitGroups.map(g => {
          const groupItems = cart.filter(i => i.splitId === g.id);
          return {
            label: g.label,
            product_ids: groupItems.map(i => i.product.id),
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

        {/* Search Results Popup */}
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
                          Estoque: {product.stock ?? 0}
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content: Cart */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Cart Header */}
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
            {cart.length > 1 && (
              <button
                onClick={splitMode ? disableSplitMode : enableSplitMode}
                className={`text-sm flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                  splitMode ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                <Users size={14} />
                {splitMode ? 'Dividindo' : 'Dividir'}
              </button>
            )}
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
                <Trash2 size={14} /> Limpar carrinho
              </button>
            )}
          </div>
        </div>

        {/* Cart Table */}
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
                    {splitMode && <th className="text-left px-4 py-3 text-sm font-medium text-gray-400 w-40">Divisão</th>}
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-400 w-32">Preço</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-400 w-40">Quantidade</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-400 w-32">Total</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {cart.map((item, idx) => {
                    const price = (item.product.promo_price != null && item.product.promo_price > 0) ? item.product.promo_price : item.product.price;
                    return (
                      <tr key={`${item.product.id}_${item.splitId}_${idx}`} className="hover:bg-gray-800/50">
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
                              <p className="font-medium text-white">{item.product.name}</p>
                              {item.product.brand && <p className="text-xs text-gray-400">{item.product.brand}</p>}
                            </div>
                          </div>
                        </td>
                        {splitMode && (
                          <td className="px-4 py-3">
                            <select
                              value={item.splitId}
                              onChange={e => assignItemToSplit(item.product.id, item.splitId, e.target.value)}
                              className="bg-gray-800 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-700 focus:border-primary-500 focus:outline-none"
                            >
                              {splitGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.label}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="px-4 py-3 text-center text-sm text-gray-400">
                          {formatCurrency(price)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.product.id, item.splitId, -1)}
                              className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-200 flex items-center justify-center transition-colors"
                            >
                              <Minus size={16} />
                            </button>
                            <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, item.splitId, 1)}
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
                            onClick={() => removeFromCart(item.product.id, item.splitId)}
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

        {/* Split Groups Cards */}
        {splitMode && splitGroups.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-400">Divisão de Pagamentos</p>
              <button
                onClick={addSplitGroup}
                className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
              >
                <UserPlus size={14} /> Adicionar pessoa
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {splitGroups.map(g => {
                const groupItems = cart.filter(i => i.splitId === g.id);
                const groupTotal = groupItems.reduce((sum, i) => {
                  const price = i.product.promo_price ?? i.product.price;
                  return sum + price * i.quantity;
                }, 0);
                return (
                  <div key={g.id} className="bg-gray-900 rounded-xl border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={g.label}
                        onChange={e => updateSplitLabel(g.id, e.target.value)}
                        className="bg-transparent text-white font-bold text-sm border-b border-dashed border-gray-700 focus:border-primary-500 focus:outline-none"
                      />
                      <button
                        onClick={() => removeSplitGroup(g.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      {groupItems.length === 0 ? (
                        <p className="italic">Nenhum item</p>
                      ) : (
                        groupItems.map((i, idx) => {
                          const price = i.product.promo_price ?? i.product.price;
                          return (
                            <div key={idx} className="flex justify-between">
                              <span>{i.quantity}x {i.product.name}</span>
                              <span>{formatCurrency(price * i.quantity)}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={g.paymentMethod}
                        onChange={e => updateSplitPayment(g.id, e.target.value)}
                        className="bg-gray-800 text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:border-primary-500 focus:outline-none flex-1"
                      >
                        {PAYMENT_METHODS.map(pm => (
                          <option key={pm.value} value={pm.value}>{pm.label}</option>
                        ))}
                      </select>
                      <span className="text-lg font-bold text-primary-600 whitespace-nowrap">{formatCurrency(groupTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom: Payment + Total */}
        {cart.length > 0 && (
          <div className="mt-4 bg-gray-900 rounded-xl border p-4">
            {splitMode ? (
              <div className="flex items-center justify-between gap-6">
                <div className="text-sm text-gray-400">
                  <p>Total divisões: <strong className="text-white">{splitGroups.length}</strong></p>
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
                {/* Payment Methods */}
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
                  </div>
                </div>

                {/* Total + Finish */}
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
    </div>
  );
}
