import axios from 'axios';
import { AppError } from '../../shared/errors/app-error';

const LICENSE_API_URL = process.env.LICENSE_API_URL || 'http://localhost:3400';

export class AuthService {
  async login(username: string, password: string) {
    try {
      const response = await axios.post(`${LICENSE_API_URL}/api/client/auth/login`, {
        username,
        password,
      });

      if (!response.data.success) {
        throw AppError.unauthorized('Credenciais inválidas');
      }

      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw AppError.unauthorized('Credenciais inválidas');
      }
      throw AppError.internal('Erro ao conectar com servidor de licenças');
    }
  }

  async getProfile(userId: string, tokenPayload?: any) {
    // Profile data comes from the JWT token since auth is now via license-server
    if (tokenPayload) {
      return {
        id: tokenPayload.id,
        username: tokenPayload.username,
        name: tokenPayload.name,
        role: tokenPayload.role,
        client_id: tokenPayload.client_id,
        client_name: tokenPayload.client_name,
      };
    }
    return { id: userId };
  }
}

export const authService = new AuthService();
