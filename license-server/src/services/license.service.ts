import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../config/database';

const JWT_SECRET = process.env.LICENSE_JWT_SECRET || 'delivery-license-secret-2024';

export class LicenseService {
  async validate(licenseKey: string, machineFingerprint: string, appId?: string) {
    const license = await queryOne(
      `SELECT l.*, c.name as client_name, c.is_active as client_active,
              p.grace_days, p.max_machines as plan_max_machines
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
      await this.logActivation(license.id, machineFingerprint, 'validate', 'failed', 'Cliente inativo');
      return { status: 'blocked' as const, message: 'Cliente inativo' };
    }

    if (license.status === 'blocked') {
      await this.logActivation(license.id, machineFingerprint, 'validate', 'failed', 'Licença bloqueada');
      return { status: 'blocked' as const, message: 'Licença bloqueada' };
    }

    const now = new Date();
    const expiresAt = new Date(license.expires_at);

    const machine = await queryOne(
      'SELECT * FROM license_machines WHERE license_id = ? AND machine_fingerprint = ? AND is_active = 1',
      [license.id, machineFingerprint]
    );

    if (!machine) {
      await this.logActivation(license.id, machineFingerprint, 'validate', 'failed', 'Máquina não ativada');
      return {
        status: 'blocked' as const,
        message: 'Máquina não ativada. Ative a licença primeiro.',
        serverTime: now.toISOString(),
      };
    }

    await query(
      'UPDATE license_machines SET last_seen_at = NOW() WHERE id = ?',
      [machine.id]
    );

    const maxMachines = license.max_machines || license.plan_max_machines || 1;

    if (expiresAt < now) {
      await query('UPDATE licenses SET status = ?, updated_at = NOW() WHERE id = ?', ['expired', license.id]);
      await this.logActivation(license.id, machineFingerprint, 'validate', 'failed', 'Licença expirada');
      const graceDays = license.grace_days ?? 3;
      const graceUntil = new Date(expiresAt);
      graceUntil.setDate(graceUntil.getDate() + graceDays);
      const withinGrace = now <= graceUntil;

      const token = this.signLicenseToken(license, machineFingerprint, maxMachines);

      return {
        status: 'expired' as const,
        customerName: license.client_name,
        expiresAt: license.expires_at,
        graceUntil: graceUntil.toISOString(),
        canCreateOrders: withinGrace,
        maxMachines,
        licenseToken: token,
        message: withinGrace ? 'Licença expirada. Período de graça ativo.' : 'Licença expirada. Período de graça encerrado.',
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

    const token = this.signLicenseToken(license, machineFingerprint, maxMachines);

    return {
      status: 'active' as const,
      customerName: license.client_name,
      expiresAt: license.expires_at,
      graceUntil: graceUntil.toISOString(),
      canCreateOrders: true,
      maxMachines,
      licenseToken: token,
      message: null,
      serverTime: now.toISOString(),
    };
  }

  async activate(licenseKey: string, machineFingerprint: string, appId?: string) {
    const license = await queryOne(
      `SELECT l.*, c.name as client_name, c.is_active as client_active,
              p.grace_days, p.max_machines as plan_max_machines
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

    const maxMachines = license.max_machines || license.plan_max_machines || 1;

    const existingMachine = await queryOne(
      'SELECT * FROM license_machines WHERE license_id = ? AND machine_fingerprint = ?',
      [license.id, machineFingerprint]
    );

    if (existingMachine) {
      await query(
        'UPDATE license_machines SET last_seen_at = NOW(), is_active = 1 WHERE id = ?',
        [existingMachine.id]
      );
    } else {
      const activeMachines = await queryOne(
        'SELECT COUNT(*) as count FROM license_machines WHERE license_id = ? AND is_active = 1',
        [license.id]
      );

      if (activeMachines && activeMachines.count >= maxMachines) {
        await this.logActivation(license.id, machineFingerprint, 'activate', 'failed', `Limite de ${maxMachines} máquinas atingido`);
        return {
          status: 'blocked' as const,
          customerName: license.client_name,
          message: `Limite de ${maxMachines} máquina(s) atingido. Desative uma máquina existente primeiro.`,
          maxMachines,
          activeMachines: activeMachines.count,
          serverTime: now.toISOString(),
        };
      }

      await query(
        'INSERT INTO license_machines (id, license_id, machine_fingerprint, last_seen_at) VALUES (?, ?, ?, NOW())',
        [uuid(), license.id, machineFingerprint]
      );
    }

    await query(
      `UPDATE licenses SET activated_at = COALESCE(activated_at, NOW()), last_validated_at = NOW(), status = 'active', updated_at = NOW() WHERE id = ?`,
      [license.id]
    );
    await this.logActivation(license.id, machineFingerprint, 'activate', 'success', null);

    const graceDays = license.grace_days ?? 3;
    const graceUntil = new Date(expiresAt);
    graceUntil.setDate(graceUntil.getDate() + graceDays);

    const token = this.signLicenseToken(license, machineFingerprint, maxMachines);

    return {
      status: 'active' as const,
      customerName: license.client_name,
      expiresAt: license.expires_at,
      graceUntil: graceUntil.toISOString(),
      canCreateOrders: true,
      maxMachines,
      licenseToken: token,
      message: null,
      serverTime: now.toISOString(),
    };
  }

  async deactivateMachine(licenseId: string, machineFingerprint: string) {
    const machine = await queryOne(
      'SELECT * FROM license_machines WHERE license_id = ? AND machine_fingerprint = ?',
      [licenseId, machineFingerprint]
    );

    if (!machine) {
      return { success: false, message: 'Máquina não encontrada' };
    }

    await query(
      'UPDATE license_machines SET is_active = 0 WHERE id = ?',
      [machine.id]
    );
    await this.logActivation(licenseId, machineFingerprint, 'deactivate', 'success', 'Desativada pelo admin');

    return { success: true, message: 'Máquina desativada' };
  }

  async getMachines(licenseId: string) {
    return query(
      'SELECT id, machine_fingerprint, machine_name, activated_at, last_seen_at, is_active FROM license_machines WHERE license_id = ? ORDER BY activated_at DESC',
      [licenseId]
    );
  }

  async listAll(filters?: { status?: string; client_id?: string }) {
    let sql = `
      SELECT l.*, c.name as client_name, p.name as plan_name,
             (SELECT COUNT(*) FROM license_machines lm WHERE lm.license_id = l.id AND lm.is_active = 1) as active_machines,
             (SELECT COUNT(*) FROM license_machines lm2 WHERE lm2.license_id = l.id) as total_machines
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

  async create(data: { client_id: string; plan_id: string; expires_at: string; max_machines?: number }) {
    const id = uuid();
    const key = this.generateKey();
    await query(
      'INSERT INTO licenses (id, license_key, client_id, plan_id, status, expires_at, max_machines) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, key, data.client_id, data.plan_id, 'pending', data.expires_at, data.max_machines || 1]
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
    await query('DELETE FROM license_machines WHERE license_id = ?', [id]);
    await query('DELETE FROM license_activations WHERE license_id = ?', [id]);
    await query('DELETE FROM licenses WHERE id = ?', [id]);
    return license;
  }

  private signLicenseToken(license: any, machineFingerprint: string, maxMachines: number): string {
    return jwt.sign(
      {
        license_key: license.license_key,
        client_id: license.client_id,
        client_name: license.client_name,
        machine_fingerprint: machineFingerprint,
        status: license.status,
        expires_at: license.expires_at,
        grace_days: license.grace_days ?? 3,
        max_machines: maxMachines,
      },
      JWT_SECRET,
      { expiresIn: '365d' }
    );
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
