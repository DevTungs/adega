import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  // Categories
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // Products
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    promo_price REAL,
    cost_price REAL,
    image_url TEXT,
    barcode TEXT,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    unit TEXT DEFAULT 'un',
    volume TEXT,
    brand TEXT,
    is_active INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)');
  db.run('CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)');

  // Product aliases
  db.run(`CREATE TABLE IF NOT EXISTS product_aliases (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_aliases_product ON product_aliases(product_id)');

  // Customers
  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT,
    cpf TEXT,
    addresses TEXT DEFAULT '[]',
    notes TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    last_order_at TEXT,
    preferences TEXT DEFAULT '{}',
    tags TEXT DEFAULT '[]',
    is_blocked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)');

  // Delivery drivers
  db.run(`CREATE TABLE IF NOT EXISTS delivery_drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    vehicle TEXT,
    plate TEXT,
    is_active INTEGER DEFAULT 1,
    is_available INTEGER DEFAULT 1,
    total_deliveries INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // Orders
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number INTEGER UNIQUE,
    customer_id TEXT REFERENCES customers(id),
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0,
    delivery_fee REAL DEFAULT 0,
    total REAL NOT NULL,
    delivery_address TEXT,
    delivery_notes TEXT,
    estimated_time INTEGER,
    assigned_driver TEXT REFERENCES delivery_drivers(id),
    whatsapp_message_id TEXT,
    notes TEXT,
    cancel_reason TEXT,
    metadata TEXT DEFAULT '{}',
    confirmed_at TEXT,
    preparing_at TEXT,
    ready_at TEXT,
    delivered_at TEXT,
    cancelled_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)');

  // Order sequence
  db.run(`CREATE TABLE IF NOT EXISTS order_sequence (last_number INTEGER DEFAULT 0)`);
  // Insert initial row if not exists
  const seqExists = db.get('SELECT 1 FROM order_sequence LIMIT 1');
  if (!seqExists) {
    db.run('INSERT INTO order_sequence (last_number) VALUES (0)');
  }

  // Order items
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)');

  // Order status history
  db.run(`CREATE TABLE IF NOT EXISTS order_status_history (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // WhatsApp sessions
  db.run(`CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    customer_id TEXT REFERENCES customers(id),
    state TEXT DEFAULT 'idle',
    context TEXT DEFAULT '{}',
    last_message_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_wa_sessions_phone ON whatsapp_sessions(phone)');

  // Audit log
  db.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    old_data TEXT,
    new_data TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC)');
}

export async function down(db: DatabaseWrapper): Promise<void> {
  const tables = [
    'audit_log', 'whatsapp_sessions',
    'order_status_history', 'order_items', 'orders', 'order_sequence',
    'delivery_drivers', 'customers', 'product_aliases',
    'products', 'categories',
  ];
  for (const table of tables) {
    db.run(`DROP TABLE IF EXISTS ${table}`);
  }
}
