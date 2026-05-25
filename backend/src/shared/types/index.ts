export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JWTPayload {
  id: string;
  username: string;
  name?: string;
  role: string;
  client_id?: string | null;
  client_name?: string | null;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'voucher';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
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
  min_stock: number;
  unit: string;
  volume: string | null;
  brand: string | null;
  is_active: number;
  is_featured: number;
  display_order: number;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  whatsapp_jid: string | null;
  name: string | null;
  email: string | null;
  cpf: string | null;
  addresses: string;
  notes: string | null;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  preferences: string;
  tags: string;
  is_blocked: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  customer_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  delivery_address: string | null;
  delivery_notes: string | null;
  estimated_time: number | null;
  assigned_driver: string | null;
  coupon_id: string | null;
  whatsapp_message_id: string | null;
  notes: string | null;
  cancel_reason: string | null;
  metadata: string;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
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
  created_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: string;
  value: number | null;
  min_order_value: number | null;
  min_quantity: number | null;
  applicable_products: string;
  applicable_categories: string;
  buy_quantity: number | null;
  get_quantity: number | null;
  start_date: string;
  end_date: string;
  is_active: number;
  max_uses: number | null;
  current_uses: number;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: string;
  value: number;
  min_order_value: number | null;
  max_discount: number | null;
  max_uses: number | null;
  current_uses: number;
  per_customer: number;
  start_date: string;
  end_date: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppSession {
  id: string;
  phone: string;
  customer_id: string | null;
  state: string;
  context: string;
  last_message_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  name: string | null;
  role: string;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LicenseStatus = 'active' | 'expired' | 'blocked' | 'invalid' | 'pending' | 'tampered';

export interface License {
  id: string;
  license_key: string;
  status: LicenseStatus;
  customer_name: string | null;
  machine_fingerprint: string;
  expires_at: string | null;
  last_validated_at: string | null;
  last_error: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface AIResponse {
  intent: string;
  products: Array<{
    name: string;
    quantity: number;
    product_id?: string;
    price?: number;
  }>;
  needs_confirmation: boolean;
  confidence: number;
  message: string;
  suggestions?: string[];
}

export interface Catalog {
  categories: (Category & { products: Product[] })[];
  promotions: Promotion[];
}
