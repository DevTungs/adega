import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  db.run(`CREATE TABLE IF NOT EXISTS cash_registers (
    id TEXT PRIMARY KEY,
    opened_by TEXT NOT NULL,
    opened_at TEXT DEFAULT (datetime('now')),
    closed_at TEXT,
    opening_amount REAL DEFAULT 0,
    closing_amount REAL,
    status TEXT DEFAULT 'open',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_cash_registers_opened ON cash_registers(opened_at DESC)');

  db.run(`CREATE TABLE IF NOT EXISTS cash_movements (
    id TEXT PRIMARY KEY,
    cash_register_id TEXT REFERENCES cash_registers(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    payment_method TEXT,
    order_id TEXT REFERENCES orders(id),
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cash_movements(cash_register_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_cash_movements_order ON cash_movements(order_id)');
}

export async function down(db: DatabaseWrapper): Promise<void> {
  db.run('DROP TABLE IF EXISTS cash_movements');
  db.run('DROP TABLE IF EXISTS cash_registers');
}
