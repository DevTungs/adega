import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  try {
    db.run('ALTER TABLE product_modifiers ADD COLUMN creates_splits INTEGER DEFAULT 0');
  } catch { }

  try {
    db.run('DROP TABLE IF EXISTS order_item_splits_temp');
    db.run(`CREATE TABLE order_item_splits_temp (
      id TEXT PRIMARY KEY,
      order_item_id TEXT NOT NULL REFERENCES order_items(id),
      product_id TEXT REFERENCES products(id),
      modifier_option_id TEXT REFERENCES modifier_options(id),
      name TEXT NOT NULL,
      ratio REAL DEFAULT 0.5,
      sort_order INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`INSERT INTO order_item_splits_temp SELECT id, order_item_id, product_id, NULL, product_name, ratio, sort_order, created_at FROM order_item_splits`);
    db.run('DROP TABLE IF EXISTS order_item_splits');
    db.run('ALTER TABLE order_item_splits_temp RENAME TO order_item_splits');
  } catch { }
  db.run('CREATE INDEX IF NOT EXISTS idx_splits_orderitem ON order_item_splits(order_item_id)');
}

export async function down(db: DatabaseWrapper): Promise<void> {
  try {
    db.run('DROP TABLE IF EXISTS order_item_splits_temp');
    db.run(`CREATE TABLE order_item_splits_temp (
      id TEXT PRIMARY KEY,
      order_item_id TEXT NOT NULL REFERENCES order_items(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      ratio REAL DEFAULT 0.5,
      sort_order INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    db.run(`INSERT INTO order_item_splits_temp SELECT id, order_item_id, product_id, product_name, ratio, sort_order, created_at FROM order_item_splits`);
    db.run('DROP TABLE IF EXISTS order_item_splits');
    db.run('ALTER TABLE order_item_splits_temp RENAME TO order_item_splits');
  } catch { }
}
