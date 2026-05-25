import { DatabaseWrapper } from '../../config/database';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

export async function seed(db: DatabaseWrapper): Promise<void> {
  // Admin user
  const adminExists = db.get('SELECT 1 FROM admin_users WHERE username = ?', ['admin']);
  if (!adminExists) {
    db.insert('admin_users', {
      id: uuid(),
      username: 'admin',
      password_hash: bcrypt.hashSync('admin123', 10),
      name: 'Administrador',
      role: 'admin',
    });
  }

  // No seed data for categories/products — each business registers their own catalog via admin panel
  console.log('[Seed] Initial data inserted');
}
