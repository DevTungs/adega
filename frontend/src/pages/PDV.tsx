import { useEffect, useState, useMemo, useRef } from 'react';
import { productsApi, categoriesApi } from '../api/products';
import { ordersApi } from '../api/orders';
import { cashRegisterApi } from '../api/cash-register';
import { Product, Category } from '../types';
import { formatCurrency } from '../utils/format';
import { Search, Plus, Minus, Trash2, ShoppingCart, X, CreditCard, Banknote, Smartphone, Wallet, Barcode, ScanBarcode } from 'lucide-react';
import toast from 'react-hot-toast';
import CashRegisterModal from '../components/cash-register/CashRegisterModal';

interface CartItem {
  product: Product;
  quantity: number;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
  { value: 'credit_card', label: 'Crédito', icon: CreditCard },
  { value: 'debit_card', label: 'Débito', icon: CreditCard },
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'voucher', label: 'Vale', icon: Wallet },
];

export default function PDV() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [cashRegisterOpen, setCashRegisterOpen] = useState<boolean>(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    checkCashRegister();
  }, []);

  // Keep barcode input focused for scanner hardware
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const loadData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        productsApi.getCatalog(),
        categoriesApi.getAll(),
      ]);
      setProducts(prodRes.data.data.flatMap((g: any) => g.products || []));
      setCategories(catRes.data.data);
    } catch {
      toast.error('Erro ao carregar produtos');
    }
  };

  const checkCashRegister = async () => {
    try {
      const { data } = await cashRegisterApi.getCurrent();
      setCashRegisterOpen(!!data.data);
    } catch {}
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (p.is_active !== 1) return false;
      if (categoryFilter && p.category_id !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.name.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s) || p.barcode?.includes(s);
      }
      return true;
    });
  }, [products, search, categoryFilter]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleBarcodeSearch = async () => {
    const code = barcodeInput.trim();
    if (!code) return;

    setBarcodeLoading(true);
    try {
      // First check local products by barcode
      const localMatch = products.find(p => p.barcode === code);
      if (localMatch) {
        addToCart(localMatch);
        toast.success(`${localMatch.name} adicionado!`);
        setBarcodeInput('');
        return;
      }

      // If not found locally, try the API (local DB + Open Food Facts)
      const { data } = await productsApi.searchByBarcode(code);
      if (data.data?.found) {
        const product = data.data.product;
        if (data.data.source === 'api') {
          // Product found via Open Food Facts - reload catalog to include it
          toast.success(`${product.name} encontrado e cadastrado!`);
          await loadData();
        } else {
          toast.success(`${product.name} adicionado!`);
        }
        addToCart(product);
        setBarcodeInput('');
      } else {
        toast.error('Produto não encontrado');
        setBarcodeInput('');
      }
    } catch {
      toast.error('Erro ao buscar produto');
    } finally {
      setBarcodeLoading(false);
      barcodeRef.current?.focus();
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, i) => {
    const price = i.product.promo_price || i.product.price;
    return sum + price * i.quantity;
  }, 0);

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handleFinishSale = async () => {
    if (cart.length === 0) return toast.error('Adicione itens ao carrinho');
    setLoading(true);
    try {
      const { data } = await ordersApi.create({
        customer_id: 'pdv-walk-in',
        items: cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
        payment_method: paymentMethod,
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
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">PDV - Ponto de Venda</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCashModal(true)}
            className={`btn-secondary flex items-center gap-2 ${cashRegisterOpen ? 'text-green-600' : 'text-red-600'}`}
          >
            <Wallet size={18} />
            {cashRegisterOpen ? 'Caixa Aberto' : 'Caixa Fechado'}
          </button>
        </div>
      </div>

      {/* Barcode Scanner */}
      <div className="mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <ScanBarcode size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={barcodeRef}
              type="text"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleBarcodeSearch(); }}
              placeholder="Escanear código de barras... (F2)"
              className="input pl-11 pr-4 py-2.5 text-lg font-mono tracking-wider"
              disabled={barcodeLoading}
              autoFocus
            />
          </div>
          <button
            onClick={handleBarcodeSearch}
            disabled={barcodeLoading || !barcodeInput.trim()}
            className="btn-primary px-4 flex items-center gap-2 disabled:opacity-50"
          >
            <Barcode size={18} />
            {barcodeLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* LEFT - Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search + Filter */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produto por nome ou marca..."
                className="input pl-10"
              />
            </div>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="input w-auto">
              <option value="">Todas categorias</option>
              {categories.filter(c => c.is_active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {filteredProducts.map(product => {
                const price = product.promo_price || product.price;
                const inCart = cart.find(i => i.product.id === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`relative bg-white border-2 rounded-xl p-3 text-left transition-all hover:shadow-md active:scale-95 ${inCart ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}
                  >
                    {inCart && (
                      <span className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                    {product.image_url ? (
                      <div className="w-full h-16 mb-2 rounded-lg overflow-hidden bg-gray-100">
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-full h-16 mb-2 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                        {product.name.charAt(0)}
                      </div>
                    )}
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className="text-primary-600 font-bold text-sm">{formatCurrency(price)}</p>
                    {product.stock <= 5 && product.stock > 0 && (
                      <p className="text-xs text-orange-500">Estoque: {product.stock}</p>
                    )}
                    {product.stock <= 0 && (
                      <p className="text-xs text-red-500">Sem estoque</p>
                    )}
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
                  Nenhum produto encontrado
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT - Cart */}
        <div className="w-80 bg-white rounded-xl border flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <ShoppingCart size={18} /> Carrinho
            </h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700">Limpar</button>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Escaneie um código de barras ou toque nos produtos</p>
              </div>
            ) : (
              cart.map(item => {
                const price = item.product.promo_price || item.product.price;
                return (
                  <div key={item.product.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(price)} cada</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 flex items-center justify-center">
                        <Plus size={14} />
                      </button>
                      <button onClick={() => removeFromCart(item.product.id)} className="w-7 h-7 rounded bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center ml-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="text-right min-w-[70px]">
                      <p className="text-sm font-bold">{formatCurrency(price * item.quantity)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Payment Method */}
          <div className="px-4 py-2 border-t">
            <p className="text-xs font-medium text-gray-500 mb-2">Forma de Pagamento</p>
            <div className="grid grid-cols-5 gap-1">
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.value}
                  onClick={() => setPaymentMethod(pm.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors ${paymentMethod === pm.value ? 'bg-primary-100 text-primary-700 border border-primary-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                >
                  <pm.icon size={16} />
                  <span className="truncate w-full text-center">{pm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Total + Finish */}
          <div className="p-4 border-t space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
              <span className="text-2xl font-bold text-primary-600">{formatCurrency(subtotal)}</span>
            </div>
            <button
              onClick={handleFinishSale}
              disabled={cart.length === 0 || loading}
              className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Finalizando...' : 'Finalizar Venda'}
            </button>
          </div>
        </div>
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
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-bold mb-2">Venda Finalizada!</h3>
            {lastOrderNumber && <p className="text-gray-500 mb-4">Pedido #{lastOrderNumber}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowSuccess(false); setBarcodeInput(''); barcodeRef.current?.focus(); }} className="btn-primary flex-1">Nova Venda</button>
              <button onClick={() => setShowSuccess(false)} className="btn-secondary flex-1">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
