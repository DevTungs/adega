import bcrypt from 'bcryptjs';
import { qb } from '../../config/database';
import { AppError } from '../../shared/errors/app-error';

interface LocalUser {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  role: string;
  is_active: number;
}

export class AuthService {
  async login(username: string, password: string) {
    let user: LocalUser | undefined;
    try {
      user = qb.selectOne('users', '*', 'username = ? AND is_active = 1', [username]) as LocalUser | undefined;
    } catch {
      throw AppError.unauthorized('Credenciais inválidas');
    }

    if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
      throw AppError.unauthorized('Credenciais inválidas');
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      client_id: null,
      client_name: null,
    };
  }

  async getProfile(userId: string, tokenPayload?: any) {
    if (tokenPayload) {
      return {
        id: tokenPayload.id,
        username: tokenPayload.username,
        name: tokenPayload.name,
        role: tokenPayload.role,
        client_id: tokenPayload.client_id || null,
        client_name: tokenPayload.client_name || null,
      };
    }

    // Fallback: query local DB
    const user = qb.selectOne('users', 'id, username, name, role', 'id = ? AND is_active = 1', [userId]) as any;
    if (!user) {
      throw AppError.unauthorized('Usuário não encontrado');
    }
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      client_id: null,
      client_name: null,
    };
  }
}

export const authService = new AuthService();
