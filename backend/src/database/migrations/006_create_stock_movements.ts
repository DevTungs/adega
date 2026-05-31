import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  db.run(`CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type)');
  db.run('CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC)');
}

export async function down(db: DatabaseWrapper): Promise<void> {
  db.run('DROP TABLE IF EXISTS stock_movements');
}
