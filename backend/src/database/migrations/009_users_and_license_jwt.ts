import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS license_tokens (
      id TEXT PRIMARY KEY,
      license_key TEXT,
      token TEXT NOT NULL,
      machine_fingerprint TEXT,
      gtin_token TEXT,
      gtin_token_expires TEXT,
      activated_at TEXT,
      last_refreshed_at TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS barcode_cache (
      barcode TEXT PRIMARY KEY,
      product_name TEXT,
      brand TEXT,
      category TEXT,
      volume TEXT,
      image_url TEXT,
      description TEXT,
      fetched_at TEXT
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  db.run('CREATE INDEX IF NOT EXISTS idx_license_tokens_key ON license_tokens(license_key)');
  db.run('CREATE INDEX IF NOT EXISTS idx_barcode_cache_barcode ON barcode_cache(barcode)');
}
