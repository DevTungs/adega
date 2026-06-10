export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'voucher';

export interface PaymentSplit {
  label: string;
  product_ids: string[];
  payment_method: PaymentMethod;
  total: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  is_active: number;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  cost_price: number | null;
  image_url: string | null;
  barcode: string | null;
  stock: number;
  unit: string;
  volume: string | null;
  brand: string | null;
  is_active: number;
  is_featured: number;
  variants?: ProductVariant[];
  modifiers?: ProductModifier[];
}

export interface Customer {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
}

export interface Order {
  id: string;
  order_number: number;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  payment_splits?: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  delivery_address: string | null;
  delivery_notes: string | null;
  estimated_time: number | null;
  notes: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  variant_id?: string | null;
  halves?: OrderItemSplit[];
  modifiers?: OrderItemModifier[];
}

export interface DeliveryDriver {
  id: string;
  name: string;
  phone: string;
  vehicle: string | null;
  plate: string | null;
  is_active: number;
  is_available: number;
  total_deliveries: number;
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  avgOrder: number;
  byStatus: Array<{ status: string; count: number }>;
}

export interface User {
  id: string;
  username: string;
  name: string | null;
  role: string;
  client_id?: string | null;
  client_name?: string | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  stock: number | null;
  barcode: string | null;
  sort_order: number;
  is_active: number;
}

export interface ProductModifier {
  id: string;
  product_id: string;
  name: string;
  type: 'single' | 'multiple' | 'required';
  min_select: number;
  max_select: number;
  sort_order: number;
  is_active: number;
  creates_splits: number;
  options?: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  modifier_id: string;
  name: string;
  price_add: number;
  sort_order: number;
  is_active: number;
}

export interface OrderItemSplit {
  id: string;
  order_item_id: string;
  product_id: string | null;
  modifier_option_id: string | null;
  name: string;
  ratio: number;
  sort_order: number;
}

export interface OrderItemModifier {
  id: string;
  order_item_id: string;
  modifier_id: string;
  option_id: string;
  option_name: string;
  price_add: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cnpj: string | null;
  address: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}
