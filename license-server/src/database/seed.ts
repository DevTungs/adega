import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'licenses',
  });

  // Default admin
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const [existing] = await conn.execute('SELECT id FROM admins WHERE username = ?', [adminUser]);
  if ((existing as any[]).length === 0) {
    const hash = bcrypt.hashSync(adminPass, 10);
    await conn.execute(
      'INSERT INTO admins (id, username, password_hash, name) VALUES (?, ?, ?, ?)',
      [uuid(), adminUser, hash, 'Administrador']
    );
    console.log(`[Seed] Admin created: ${adminUser}`);
  } else {
    console.log('[Seed] Admin already exists');
  }

  // Default monthly plan
  const [plans] = await conn.execute('SELECT id FROM plans WHERE name = ?', ['Mensal']);
  if ((plans as any[]).length === 0) {
    await conn.execute(
      'INSERT INTO plans (id, name, description, duration_days, grace_days, price) VALUES (?, ?, ?, ?, ?, ?)',
      [uuid(), 'Mensal', 'Plano mensal - 30 dias', 30, 3, 99.90]
    );
    console.log('[Seed] Monthly plan created');
  } else {
    console.log('[Seed] Monthly plan already exists');
  }

  console.log('[Seed] Done!');
  await conn.end();
}

seed().catch((err) => {
  console.error('[Seed] Error:', err.message);
  process.exit(1);
});
