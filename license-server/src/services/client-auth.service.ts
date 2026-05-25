import bcrypt from 'bcryptjs';
import { queryOne } from '../config/database';

export class ClientAuthService {
  async login(username: string, password: string) {
    const user = await queryOne(
      `SELECT cu.*, c.name as client_name, c.is_active as client_active
       FROM client_users cu
       LEFT JOIN clients c ON c.id = cu.client_id
       WHERE cu.username = ? AND cu.is_active = 1`,
      [username]
    );

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return null;
    }

    // If user is linked to a client, check client is active
    if (user.client_id && !user.client_active) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      client_id: user.client_id,
      client_name: user.client_name,
    };
  }
}

export const clientAuthService = new ClientAuthService();
