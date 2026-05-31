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

  // Walk-in customer for PDV sales
  const walkInExists = db.get('SELECT 1 FROM customers WHERE id = ?', ['pdv-walk-in']);
  if (!walkInExists) {
    db.insert('customers', {
      id: 'pdv-walk-in',
      phone: '00000000000',
      name: 'Cliente Balcão',
      email: null,
      cpf: null,
      addresses: '[]',
      notes: 'Cliente padrão para vendas no PDV',
      total_orders: 0,
      total_spent: 0,
      preferences: '{}',
      tags: '[]',
    });
  }

  // No seed data for categories/products — each business registers their own catalog via admin panel
  console.log('[Seed] Initial data inserted');
}
