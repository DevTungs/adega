import axios from 'axios';
import jwt from 'jsonwebtoken';
import { AppError } from '../../shared/errors/app-error';
import { LicenseStatus } from '../../shared/types';
import { config } from '../../config/app.config';
import { licenseModel } from './license.model';
import { getMachineFingerprint, getStableFingerprint } from './machine-fingerprint';

const MAX_VALIDATION_INTERVAL_MS = 30 * 60 * 1000; // 30 min between refresh attempts
const SERVER_CHECK_TTL_MS = 5 * 60 * 1000; // cache server reachability for 5 min

interface LicenseJWTPayload {
  license_key: string;
  client_id: string;
  client_name: string;
  machine_fingerprint: string;
  status: string;
  expires_at: string;
  grace_days: number;
  max_machines: number;
  iat: number;
  exp: number;
}

export class LicenseService {
  private lastServerCheck: { reachable: boolean; at: number } | null = null;

  getStatus() {
    const cached = licenseModel.getCurrent();
    if (!cached) {
      return {
        status: 'pending' as LicenseStatus,
        customerName: null,
        expiresAt: null,
        lastValidatedAt: null,
        lastError: null,
        canCreateOrders: false,
        offline: !this.isServerReachable(),
        message: 'Ative a licença para criar pedidos.',
      };
    }

    const result = this.buildStatusFromToken(cached.token);
    return { ...result, offline: !this.isServerReachable() };
  }

  async activate(licenseKey: string) {
    const fingerprint = getMachineFingerprint();
    const baseUrl = config.licenseApiUrl;
    if (!baseUrl) {
      throw AppError.badRequest('Servidor de licença não configurado');
    }

    try {
      const { data } = await axios.post(
        `${baseUrl.replace(/\/$/, '')}/api/client/licenses/activate`,
        { licenseKey, machineFingerprint: fingerprint, appId: config.licenseAppId },
        { timeout: 10000 }
      );

      if (data.status !== 'active' || !data.licenseToken) {
        return {
          status: data.status as LicenseStatus,
          customerName: data.customerName || null,
          expiresAt: data.expiresAt || null,
          lastValidatedAt: null,
          lastError: data.message || null,
          canCreateOrders: false,
          message: data.message || 'Falha na ativação',
        };
      }

      // Store JWT locally
      licenseModel.upsert({
        license_key: licenseKey,
        token: data.licenseToken,
        machine_fingerprint: fingerprint,
        stable_fingerprint: getStableFingerprint(),
      });

      return this.buildStatusFromToken(data.licenseToken);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const msg = error.response.data.message || 'Erro ao ativar licença';
        throw AppError.badRequest(msg);
      }
      throw AppError.internal('Erro ao conectar com servidor de licenças');
    }
  }

  async validateCurrent(force = false) {
    const cached = licenseModel.getCurrent();
    if (!cached) {
      return {
        status: 'pending' as LicenseStatus,
        customerName: null,
        expiresAt: null,
        lastValidatedAt: null,
        lastError: null,
        canCreateOrders: false,
        offline: !this.isServerReachable(),
        message: 'Ative a licença para criar pedidos.',
      };
    }

    // Always try local validation first — this NEVER blocks due to server issues
    const localResult = this.buildStatusFromToken(cached.token);

    // If local result says blocked (explicitly blocked by admin), no point refreshing
    if (localResult.status === 'blocked') {
      return { ...localResult, offline: !this.isServerReachable() };
    }

    // Try to refresh from server if enough time has passed (best-effort)
    if (force || this.shouldRefresh(cached.last_refreshed_at)) {
      try {
        const refreshed = await this.refreshFromServer(cached.license_key);
        if (refreshed) {
          return { ...refreshed, offline: false };
        }
        // refreshFromServer returned null — server responded but no token (e.g. machine not activated)
        this.lastServerCheck = { reachable: true, at: Date.now() };
      } catch {
        // Server unavailable
        this.lastServerCheck = { reachable: false, at: Date.now() };
      }
    }

    return { ...localResult, offline: !this.isServerReachable() };
  }

  async ensureCanCreateOrder() {
    const status = await this.validateCurrent(false);
    if (!status.canCreateOrders) {
      throw new AppError(
        status.message || 'Mensalidade vencida. Regularize a licença para criar novos pedidos.',
        402,
        'LICENSE_REQUIRED'
      );
    }
  }

  /**
   * Build status from cached JWT token.
   * This NEVER blocks due to server unavailability.
   * Only blocks if: status=blocked OR expires_at passed AND grace expired.
   */
  private buildStatusFromToken(token: string) {
    let decoded: LicenseJWTPayload;

    try {
      decoded = jwt.verify(token, config.licenseJwtSecret) as LicenseJWTPayload;
    } catch (verifyError) {
      // JWT expired by time (exp field) — try decode without verification
      // The token might still have valid data, just the exp field passed
      try {
        decoded = jwt.decode(token) as LicenseJWTPayload;
        if (!decoded) {
          return this.invalidTokenStatus();
        }
      } catch {
        return this.invalidTokenStatus();
      }
    }

    // Verify fingerprint matches this machine
    const currentFingerprint = getMachineFingerprint();
    if (decoded.machine_fingerprint !== currentFingerprint) {
      // Fingerprint mismatch. Could be:
      // (a) Same machine, network adapters changed (VPN, virtual adapters)
      // (b) Different machine (DB file copied, or license stolen)
      //
      // Use stable fingerprint (hostname + platform + arch + CPU, no MACs) to distinguish.
      const cached = licenseModel.getCurrent();
      const storedStableFp = cached?.stable_fingerprint;
      const currentStableFp = getStableFingerprint();

      let isSameMachine = false;

      if (storedStableFp) {
        // We have a stored stable fingerprint from a previous activation/refresh.
        isSameMachine = storedStableFp === currentStableFp;
      } else {
        // Backwards compatibility: no stable_fingerprint stored (old activation).
        // If the DB's machine_fingerprint matches the JWT's, the DB was last written
        // on the machine the JWT was issued for. Current fingerprint drift = adapter change.
        isSameMachine = cached?.machine_fingerprint === decoded.machine_fingerprint;
      }

      if (!isSameMachine) {
        return {
          status: 'blocked' as LicenseStatus,
          customerName: decoded.client_name,
          expiresAt: decoded.expires_at,
          lastValidatedAt: new Date(decoded.iat * 1000).toISOString(),
          lastError: 'Licença vinculada a outra máquina',
          canCreateOrders: false,
          message: 'Licença vinculada a outra máquina. Ative novamente.',
        };
      }

      // Same machine detected (stable fingerprint matches). Allow access.
      // The next successful server refresh will update the stored fingerprints.
    }

    // Check if license is explicitly blocked by admin
    if (decoded.status === 'blocked') {
      return {
        status: 'blocked' as LicenseStatus,
        customerName: decoded.client_name,
        expiresAt: decoded.expires_at,
        lastValidatedAt: new Date(decoded.iat * 1000).toISOString(),
        lastError: 'Licença bloqueada',
        canCreateOrders: false,
        message: 'Licença bloqueada. Entre em contato com o suporte.',
      };
    }

    // Check expiration date (this is the REAL expiration, not the JWT exp)
    const now = Date.now();
    const expiresAt = new Date(decoded.expires_at).getTime();
    const expiredByDate = expiresAt < now;
    const graceDays = decoded.grace_days || 3;
    const graceUntil = expiresAt + graceDays * 24 * 60 * 60 * 1000;
    const withinGrace = expiredByDate && now <= graceUntil;

    // Blocked: expired AND grace period ended
    if (expiredByDate && !withinGrace) {
      return {
        status: 'expired' as LicenseStatus,
        customerName: decoded.client_name,
        expiresAt: decoded.expires_at,
        lastValidatedAt: new Date(decoded.iat * 1000).toISOString(),
        lastError: 'Licença expirada e período de graça encerrado',
        canCreateOrders: false,
        message: 'Mensalidade vencida. Regularize a licença para criar novos pedidos.',
      };
    }

    // Active or within grace — system works normally
    return {
      status: (expiredByDate ? 'expired' : 'active') as LicenseStatus,
      customerName: decoded.client_name,
      expiresAt: decoded.expires_at,
      lastValidatedAt: new Date(decoded.iat * 1000).toISOString(),
      lastError: null,
      canCreateOrders: true,
      message: expiredByDate ? 'Licença expirada. Período de graça ativo. Renove a licença.' : null,
    };
  }

  private invalidTokenStatus() {
    return {
      status: 'invalid' as LicenseStatus,
      customerName: null,
      expiresAt: null,
      lastValidatedAt: null,
      lastError: 'Token de licença inválido',
      canCreateOrders: false,
      message: 'Token de licença inválido. Ative a licença.',
    };
  }

  private async refreshFromServer(licenseKey: string) {
    const baseUrl = config.licenseApiUrl;
    if (!baseUrl) return null;

    const fingerprint = getMachineFingerprint();

    try {
      const { data } = await axios.post(
        `${baseUrl.replace(/\/$/, '')}/api/client/licenses/validate`,
        { licenseKey, machineFingerprint: fingerprint, appId: config.licenseAppId },
        { timeout: 10000 }
      );

      if (data.licenseToken) {
        licenseModel.updateToken(data.licenseToken);
        licenseModel.updateLastRefreshed();
        licenseModel.updateFingerprints(getMachineFingerprint(), getStableFingerprint());
        this.lastServerCheck = { reachable: true, at: Date.now() };
        return this.buildStatusFromToken(data.licenseToken);
      }

      this.lastServerCheck = { reachable: true, at: Date.now() };
      return null;
    } catch {
      this.lastServerCheck = { reachable: false, at: Date.now() };
      return null;
    }
  }

  private shouldRefresh(lastRefreshedAt: string | null): boolean {
    if (!lastRefreshedAt) return true;
    return Date.now() - new Date(lastRefreshedAt).getTime() >= MAX_VALIDATION_INTERVAL_MS;
  }

  private isServerReachable(): boolean {
    if (!this.lastServerCheck) return true; // assume reachable until proven otherwise
    if (Date.now() - this.lastServerCheck.at > SERVER_CHECK_TTL_MS) return true; // cache expired, assume reachable
    return this.lastServerCheck.reachable;
  }

  /**
   * Return cached server reachability without making a network request.
   * Returns null if no cached result exists.
   */
  getCachedServerReachable(): boolean | null {
    if (!this.lastServerCheck) return null;
    if (Date.now() - this.lastServerCheck.at > SERVER_CHECK_TTL_MS) return null;
    return this.lastServerCheck.reachable;
  }

  /**
   * Quick non-blocking check if the license-server is reachable.
   * Caches the result for SERVER_CHECK_TTL_MS.
   */
  async checkServerReachable(force = false): Promise<boolean> {
    if (!force && this.lastServerCheck && Date.now() - this.lastServerCheck.at < SERVER_CHECK_TTL_MS) {
      return this.lastServerCheck.reachable;
    }

    const baseUrl = config.licenseApiUrl;
    if (!baseUrl) {
      this.lastServerCheck = { reachable: false, at: Date.now() };
      return false;
    }

    try {
      await axios.get(`${baseUrl.replace(/\/$/, '')}/health`, { timeout: 15000 });
      this.lastServerCheck = { reachable: true, at: Date.now() };
      return true;
    } catch {
      this.lastServerCheck = { reachable: false, at: Date.now() };
      return false;
    }
  }
}

export const licenseService = new LicenseService();
