import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  db.run(`CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    license_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    customer_name TEXT,
    machine_fingerprint TEXT NOT NULL,
    expires_at TEXT,
    last_validated_at TEXT,
    last_error TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key)');
  db.run('CREATE INDEX IF NOT EXISTS idx_licenses_expires ON licenses(expires_at)');
}
