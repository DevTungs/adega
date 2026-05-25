import axios from 'axios';
import { AppError } from '../../shared/errors/app-error';
import { License, LicenseStatus } from '../../shared/types';
import { licenseModel } from './license.model';
import { getMachineFingerprint } from './machine-fingerprint';

const MAX_VALIDATION_INTERVAL_MS = 30 * 60 * 1000; // 30 min
const MAX_OFFLINE_MS = 72 * 60 * 60 * 1000; // 72h offline limit

interface LicenseServerResponse {
  status: LicenseStatus;
  customerName?: string;
  expiresAt?: string | null;
  graceUntil?: string | null;
  canCreateOrders?: boolean;
  message?: string;
  serverTime?: string;
  metadata?: Record<string, any>;
}

export class LicenseService {
  getStatus() {
    const license = licenseModel.getCurrent();
    return this.toStatusResponse(license);
  }

  async activate(licenseKey: string) {
    const response = await this.callLicenseServer('/api/client/licenses/activate', licenseKey);
    return this.saveServerResponse(licenseKey, response);
  }

  async validateCurrent(force = false) {
    const license = licenseModel.getCurrent();
    if (!license) return this.toStatusResponse(undefined);

    // If tampered, force online validation immediately
    if (license.status === 'tampered') {
      try {
        const response = await this.callLicenseServer('/api/client/licenses/validate', license.license_key);
        return this.saveServerResponse(license.license_key, response);
      } catch {
        return this.toStatusResponse(license);
      }
    }

    if (!force && !this.shouldValidateOnline(license)) {
      return this.toStatusResponse(license);
    }

    try {
      const response = await this.callLicenseServer('/api/client/licenses/validate', license.license_key);
      return this.saveServerResponse(license.license_key, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao validar licenca';
      const updated = licenseModel.setError(message) || license;
      return this.toStatusResponse(updated);
    }
  }

  async ensureCanCreateOrder() {
    const status = await this.validateCurrent(false);
    if (!status.canCreateOrders) {
      throw new AppError(
        status.message || 'Mensalidade vencida. Regularize a licenca para criar novos pedidos.',
        402,
        'LICENSE_REQUIRED'
      );
    }
  }

  private async callLicenseServer(path: string, licenseKey: string): Promise<LicenseServerResponse> {
    const baseUrl = process.env.LICENSE_API_URL;
    if (!baseUrl) {
      throw AppError.badRequest('Servidor de licenca nao configurado');
    }

    const { data } = await axios.post<LicenseServerResponse>(`${baseUrl.replace(/\/$/, '')}${path}`, {
      licenseKey,
      appId: process.env.LICENSE_APP_ID || 'delivery',
      machineFingerprint: getMachineFingerprint(),
    }, {
      timeout: 10000,
    });

    if (!data?.status) {
      throw AppError.badRequest('Resposta invalida do servidor de licenca');
    }

    return data;
  }

  private saveServerResponse(licenseKey: string, response: LicenseServerResponse) {
    const license = licenseModel.upsert({
      license_key: licenseKey,
      status: response.status,
      customer_name: response.customerName || null,
      machine_fingerprint: getMachineFingerprint(),
      expires_at: response.expiresAt || null,
      last_validated_at: new Date().toISOString(),
      last_error: response.message || null,
      metadata: JSON.stringify({
        serverTime: response.serverTime || null,
        graceUntil: response.graceUntil || null,
        canCreateOrders: response.canCreateOrders ?? null,
        ...(response.metadata || {}),
      }),
    });

    return this.toStatusResponse(license);
  }

  private shouldValidateOnline(license: License): boolean {
    if (!license.last_validated_at) return true;
    const lastValidated = new Date(license.last_validated_at).getTime();
    return Date.now() - lastValidated >= MAX_VALIDATION_INTERVAL_MS;
  }

  private toStatusResponse(license: License | undefined) {
    if (!license) {
      return {
        status: 'pending' as LicenseStatus,
        customerName: null,
        expiresAt: null,
        lastValidatedAt: null,
        lastError: null,
        canCreateOrders: false,
        message: 'Ative a licenca para criar pedidos.',
      };
    }

    // Tampered license — try to use cached data if HMAC was valid before, but block if can't verify
    if (license.status === 'tampered') {
      return {
        status: 'tampered' as any,
        customerName: license.customer_name,
        expiresAt: license.expires_at,
        lastValidatedAt: license.last_validated_at,
        lastError: 'Dados da licenca foram adulterados',
        canCreateOrders: false,
        message: 'Licenca adulterada. Conecte-se a internet para validar.',
      };
    }

    // Read server-provided values from metadata
    let graceUntil: string | null = null;
    let serverCanCreateOrders: boolean | null = null;
    try {
      const meta = JSON.parse(license.metadata || '{}');
      graceUntil = meta.graceUntil || null;
      serverCanCreateOrders = meta.canCreateOrders ?? null;
    } catch { /* ignore */ }

    const isBlocked = license.status === 'blocked';
    const isActive = license.status === 'active';
    const expiredByDate = license.expires_at ? new Date(license.expires_at).getTime() < Date.now() : false;

    // Use server-provided graceUntil if available, otherwise no grace
    const withinGrace = graceUntil ? Date.now() <= new Date(graceUntil).getTime() : false;

    // Offline protection: if last_validated_at is too old, block
    const lastValidated = license.last_validated_at ? new Date(license.last_validated_at).getTime() : 0;
    const offlineTooLong = Date.now() - lastValidated > MAX_OFFLINE_MS;

    // canCreateOrders: prefer server value, fallback to local calculation
    let canCreateOrders: boolean;
    if (serverCanCreateOrders !== null) {
      canCreateOrders = serverCanCreateOrders && !isBlocked && !offlineTooLong;
    } else {
      canCreateOrders = isActive && !isBlocked && !offlineTooLong && (!expiredByDate || withinGrace);
    }

    const effectiveStatus: LicenseStatus = isBlocked
      ? 'blocked'
      : offlineTooLong
        ? 'expired'
        : expiredByDate
          ? 'expired'
          : license.status as LicenseStatus;

    return {
      status: effectiveStatus,
      customerName: license.customer_name,
      expiresAt: license.expires_at,
      lastValidatedAt: license.last_validated_at,
      lastError: license.last_error,
      canCreateOrders,
      message: canCreateOrders
        ? null
        : isBlocked
          ? 'Licenca bloqueada. Entre em contato com o suporte.'
          : offlineTooLong
            ? 'Licenca nao validada ha mais de 72h. Conecte-se a internet.'
            : 'Mensalidade vencida. Regularize a licenca para criar novos pedidos.',
    };
  }
}

export const licenseService = new LicenseService();
