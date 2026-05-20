import bcrypt from 'bcryptjs';
import { qb } from '../../config/database';
import { AppError } from '../../shared/errors/app-error';
import { AdminUser } from '../../shared/types';

export class AuthService {
  async login(username: string, password: string) {
    const user = qb.selectOne('admin_users', '*', 'username = ? AND is_active = ?', [username, 1]) as AdminUser | undefined;

    if (!user) {
      throw AppError.unauthorized('Credenciais inválidas');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw AppError.unauthorized('Credenciais inválidas');
    }

    qb.update('admin_users', { last_login_at: new Date().toISOString() }, 'id = ?', [user.id]);

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    };
  }

  async getProfile(userId: string) {
    const user = qb.selectOne('admin_users', 'id, username, name, role, last_login_at, created_at', 'id = ?', [userId]);

    if (!user) {
      throw AppError.notFound('Usuário não encontrado');
    }

    return user;
  }
}

export const authService = new AuthService();
