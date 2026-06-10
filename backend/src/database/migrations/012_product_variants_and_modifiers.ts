import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  // Product variants (sizes, pack sizes, portions)
  db.run(`CREATE TABLE IF NOT EXISTS product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    promo_price REAL,
    stock REAL,
    barcode TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode)');

  // Modifier groups (e.g., "Borda", "Acompanhamento", "Ponto da carne")
  db.run(`CREATE TABLE IF NOT EXISTS product_modifiers (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'single',
    min_select INTEGER DEFAULT 0,
    max_select INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_modifiers_product ON product_modifiers(product_id)');

  // Options for each modifier (e.g., "Catupiry +R$4", "Cheddar +R$4")
  db.run(`CREATE TABLE IF NOT EXISTS modifier_options (
    id TEXT PRIMARY KEY,
    modifier_id TEXT NOT NULL REFERENCES product_modifiers(id),
    name TEXT NOT NULL,
    price_add REAL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_modopts_modifier ON modifier_options(modifier_id)');

  // Add variant_id to order_items
  try {
    db.run('ALTER TABLE order_items ADD COLUMN variant_id TEXT REFERENCES product_variants(id)');
  } catch { }

  // Order item splits (half-and-half, mixed packs)
  db.run(`CREATE TABLE IF NOT EXISTS order_item_splits (
    id TEXT PRIMARY KEY,
    order_item_id TEXT NOT NULL REFERENCES order_items(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    ratio REAL DEFAULT 0.5,
    sort_order INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_splits_orderitem ON order_item_splits(order_item_id)');

  // Order item modifiers (selected add-ons)
  db.run(`CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id TEXT PRIMARY KEY,
    order_item_id TEXT NOT NULL REFERENCES order_items(id),
    modifier_id TEXT NOT NULL REFERENCES product_modifiers(id),
    option_id TEXT NOT NULL REFERENCES modifier_options(id),
    option_name TEXT NOT NULL,
    price_add REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_itemmods_orderitem ON order_item_modifiers(order_item_id)');
}

export async function down(db: DatabaseWrapper): Promise<void> {
  db.run('DROP TABLE IF EXISTS order_item_modifiers');
  db.run('DROP TABLE IF EXISTS order_item_splits');
  try {
    db.run('ALTER TABLE order_items DROP COLUMN variant_id');
  } catch { }
  db.run('DROP TABLE IF EXISTS modifier_options');
  db.run('DROP TABLE IF EXISTS product_modifiers');
  db.run('DROP TABLE IF EXISTS product_variants');
}
