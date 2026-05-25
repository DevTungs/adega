import { v4 as uuid } from 'uuid';
import { query, queryOne } from '../config/database';

export class LicenseService {
  async validate(licenseKey: string, machineFingerprint: string, appId?: string) {
    const license = await queryOne(
      `SELECT l.*, c.name as client_name, c.is_active as client_active, p.grace_days
       FROM licenses l
       JOIN clients c ON c.id = l.client_id
       JOIN plans p ON p.id = l.plan_id
       WHERE l.license_key = ?`,
      [licenseKey]
    );

    if (!license) {
      await this.logActivation(null, machineFingerprint, 'validate', 'failed', 'Licença não encontrada');
      return { status: 'invalid' as const, message: 'Licença não encontrada' };
    }

    if (!license.client_active) {
      await this.logActivation(license.id, machineFingerprint, 'validate', 'failed', 'Cliente inativo');
      return { status: 'blocked' as const, message: 'Cliente inativo' };
    }

    if (license.status === 'blocked') {
      await this.logActivation(license.id, machineFingerprint, 'validate', 'failed', 'Licença bloqueada');
      return { status: 'blocked' as const, message: 'Licença bloqueada' };
    }

    const now = new Date();
    const expiresAt = new Date(license.expires_at);

    if (expiresAt < now) {
      await query('UPDATE licenses SET status = ?, updated_at = NOW() WHERE id = ?', ['expired', license.id]);
      await this.logActivation(license.id, machineFingerprint, 'validate', 'failed', 'Licença expirada');
      const graceDays = license.grace_days ?? 3;
      const graceUntil = new Date(expiresAt);
      graceUntil.setDate(graceUntil.getDate() + graceDays);
      const withinGrace = now <= graceUntil;
      return {
        status: 'expired' as const,
        customerName: license.client_name,
        expiresAt: license.expires_at,
        graceUntil: graceUntil.toISOString(),
        canCreateOrders: withinGrace,
        message: withinGrace ? 'Licença expirada. Período de graça ativo.' : 'Licença expirada. Período de graça encerrado.',
        serverTime: now.toISOString(),
      };
    }

    if (license.machine_fingerprint && license.machine_fingerprint !== machineFingerprint) {
      await this.logActivation(license.id, machineFingerprint, 'validate', 'failed', 'Fingerprint diferente');
      return {
        status: 'blocked' as const,
        customerName: license.client_name,
        message: 'Licença vinculada a outra máquina',
        serverTime: now.toISOString(),
      };
    }

    await query(
      'UPDATE licenses SET last_validated_at = NOW(), status = ?, updated_at = NOW() WHERE id = ?',
      ['active', license.id]
    );
    await this.logActivation(license.id, machineFingerprint, 'validate', 'success', null);

    const graceDays = license.grace_days ?? 3;
    const graceUntil = new Date(expiresAt);
    graceUntil.setDate(graceUntil.getDate() + graceDays);

    return {
      status: 'active' as const,
      customerName: license.client_name,
      expiresAt: license.expires_at,
      graceUntil: graceUntil.toISOString(),
      canCreateOrders: true,
      message: null,
      serverTime: now.toISOString(),
    };
  }

  async activate(licenseKey: string, machineFingerprint: string, appId?: string) {
    const license = await queryOne(
      `SELECT l.*, c.name as client_name, c.is_active as client_active, p.grace_days
       FROM licenses l
       JOIN clients c ON c.id = l.client_id
       JOIN plans p ON p.id = l.plan_id
       WHERE l.license_key = ?`,
      [licenseKey]
    );

    if (!license) {
      return { status: 'invalid' as const, message: 'Licença não encontrada' };
    }

    if (!license.client_active) {
      return { status: 'blocked' as const, message: 'Cliente inativo' };
    }

    if (license.status === 'blocked') {
      return { status: 'blocked' as const, message: 'Licença bloqueada' };
    }

    const now = new Date();
    const expiresAt = new Date(license.expires_at);

    if (expiresAt < now) {
      return {
        status: 'expired' as const,
        customerName: license.client_name,
        expiresAt: license.expires_at,
        message: 'Licença expirada. Renove antes de ativar.',
        serverTime: now.toISOString(),
      };
    }

    await query(
      `UPDATE licenses SET machine_fingerprint = ?, activated_at = NOW(), last_validated_at = NOW(), status = 'active', updated_at = NOW() WHERE id = ?`,
      [machineFingerprint, license.id]
    );
    await this.logActivation(license.id, machineFingerprint, 'activate', 'success', null);

    const graceDays = license.grace_days ?? 3;
    const graceUntil = new Date(expiresAt);
    graceUntil.setDate(graceUntil.getDate() + graceDays);

    return {
      status: 'active' as const,
      customerName: license.client_name,
      expiresAt: license.expires_at,
      graceUntil: graceUntil.toISOString(),
      canCreateOrders: true,
      message: null,
      serverTime: now.toISOString(),
    };
  }

  async listAll(filters?: { status?: string; client_id?: string }) {
    let sql = `
      SELECT l.*, c.name as client_name, p.name as plan_name
      FROM licenses l
      JOIN clients c ON c.id = l.client_id
      JOIN plans p ON p.id = l.plan_id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.status) {
      conditions.push('l.status = ?');
      params.push(filters.status);
    }
    if (filters?.client_id) {
      conditions.push('l.client_id = ?');
      params.push(filters.client_id);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY l.created_at DESC';

    return query(sql, params);
  }

  async getById(id: string) {
    return queryOne(
      `SELECT l.*, c.name as client_name, p.name as plan_name
       FROM licenses l
       JOIN clients c ON c.id = l.client_id
       JOIN plans p ON p.id = l.plan_id
       WHERE l.id = ?`,
      [id]
    );
  }

  async create(data: { client_id: string; plan_id: string; expires_at: string }) {
    const id = uuid();
    const key = this.generateKey();
    await query(
      'INSERT INTO licenses (id, license_key, client_id, plan_id, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, key, data.client_id, data.plan_id, 'pending', data.expires_at]
    );
    return this.getById(id);
  }

  async renew(id: string, newExpiresAt: string) {
    await query(
      'UPDATE licenses SET expires_at = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [newExpiresAt, 'active', id]
    );
    return this.getById(id);
  }

  async block(id: string) {
    await query('UPDATE licenses SET status = ?, updated_at = NOW() WHERE id = ?', ['blocked', id]);
    return this.getById(id);
  }

  async unblock(id: string) {
    await query('UPDATE licenses SET status = ?, updated_at = NOW() WHERE id = ?', ['active', id]);
    return this.getById(id);
  }

  async remove(id: string) {
    const license = await this.getById(id);
    if (!license) return null;
    await query('DELETE FROM license_activations WHERE license_id = ?', [id]);
    await query('DELETE FROM licenses WHERE id = ?', [id]);
    return license;
  }

  private generateKey(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = '';
    for (let i = 0; i < 4; i++) {
      let segment = '';
      for (let j = 0; j < 5; j++) {
        segment += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      key += (i > 0 ? '-' : '') + segment;
    }
    return key;
  }

  private async logActivation(
    licenseId: string | null,
    fingerprint: string,
    action: string,
    result: string,
    message: string | null
  ) {
    await query(
      'INSERT INTO license_activations (id, license_id, machine_fingerprint, action, result, message) VALUES (?, ?, ?, ?, ?, ?)',
      [uuid(), licenseId, fingerprint, action, result, message]
    );
  }
}

export const licenseService = new LicenseService();
