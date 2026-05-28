import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  db.run(`CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    cnpj TEXT,
    address TEXT,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active)');
}

export async function down(db: DatabaseWrapper): Promise<void> {
  db.run('DROP TABLE IF EXISTS suppliers');
}
