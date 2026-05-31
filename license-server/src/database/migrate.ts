import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const dbName = process.env.DB_NAME || 'licenses';
  console.log(`[Migrate] Creating database ${dbName}...`);
  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await conn.execute(`USE \`${dbName}\``);

  console.log('[Migrate] Creating tables...');

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      notes TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS plans (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      duration_days INT NOT NULL DEFAULT 30,
      grace_days INT NOT NULL DEFAULT 3,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS licenses (
      id VARCHAR(36) PRIMARY KEY,
      license_key VARCHAR(100) NOT NULL UNIQUE,
      client_id VARCHAR(36) NOT NULL,
      plan_id VARCHAR(36) NOT NULL,
      status ENUM('active','expired','blocked','pending') DEFAULT 'pending',
      machine_fingerprint VARCHAR(255),
      max_machines INT NOT NULL DEFAULT 1,
      activated_at DATETIME,
      expires_at DATETIME NOT NULL,
      last_validated_at DATETIME,
      metadata JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS license_activations (
      id VARCHAR(36) PRIMARY KEY,
      license_id VARCHAR(36) NOT NULL,
      machine_fingerprint VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      action ENUM('activate','validate','deactivate') NOT NULL,
      result ENUM('success','failed') NOT NULL,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS client_users (
      id VARCHAR(36) PRIMARY KEY,
      client_id VARCHAR(36),
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'admin',
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS license_machines (
      id VARCHAR(36) PRIMARY KEY,
      license_id VARCHAR(36) NOT NULL,
      machine_fingerprint VARCHAR(255) NOT NULL,
      machine_name VARCHAR(255),
      activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME,
      is_active TINYINT(1) DEFAULT 1,
      FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
      UNIQUE KEY uk_license_fingerprint (license_id, machine_fingerprint)
    )
  `);

  // Indexes
  await conn.execute('CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key)');
  await conn.execute('CREATE INDEX IF NOT EXISTS idx_licenses_client ON licenses(client_id)');
  await conn.execute('CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status)');
  await conn.execute('CREATE INDEX IF NOT EXISTS idx_licenses_expires ON licenses(expires_at)');
  await conn.execute('CREATE INDEX IF NOT EXISTS idx_activations_license ON license_activations(license_id)');
  await conn.execute('CREATE INDEX IF NOT EXISTS idx_machines_license ON license_machines(license_id)');

  // Add max_machines_override to clients if not exists (safe with try/catch)
  try {
    await conn.execute('ALTER TABLE clients ADD COLUMN max_machines_override INT DEFAULT NULL');
  } catch { /* column already exists */ }

  // Add max_machines to plans if not exists
  try {
    await conn.execute('ALTER TABLE plans ADD COLUMN max_machines INT NOT NULL DEFAULT 1');
  } catch { /* column already exists */ }

  // Add GTIN API credentials to clients
  try {
    await conn.execute('ALTER TABLE clients ADD COLUMN gtin_username VARCHAR(255) DEFAULT NULL');
  } catch { /* column already exists */ }
  try {
    await conn.execute('ALTER TABLE clients ADD COLUMN gtin_password VARCHAR(255) DEFAULT NULL');
  } catch { /* column already exists */ }

  console.log('[Migrate] Done!');
  await conn.end();
}

migrate().catch((err) => {
  console.error('[Migrate] Error:', err.message);
  process.exit(1);
});
