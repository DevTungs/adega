import { qb } from '../../config/database';
import { v4 as uuid } from 'uuid';

export interface LicenseToken {
  id: string;
  license_key: string;
  token: string;
  machine_fingerprint: string;
  stable_fingerprint: string | null;
  gtin_token: string | null;
  gtin_token_expires: string | null;
  activated_at: string;
  last_refreshed_at: string;
  created_at: string;
  updated_at: string;
}

export class LicenseModel {
  getCurrent(): LicenseToken | undefined {
    return qb.selectOne('license_tokens', '*', undefined, []) as LicenseToken | undefined;
  }

  upsert(data: { license_key: string; token: string; machine_fingerprint: string; stable_fingerprint?: string }): LicenseToken {
    const current = qb.selectOne('license_tokens', '*', undefined, []) as LicenseToken | undefined;
    const now = new Date().toISOString();

    if (current) {
      qb.update('license_tokens', {
        license_key: data.license_key,
        token: data.token,
        machine_fingerprint: data.machine_fingerprint,
        stable_fingerprint: data.stable_fingerprint || null,
        last_refreshed_at: now,
        updated_at: now,
      }, 'id = ?', [current.id]);
      return this.getCurrent()!;
    }

    const id = uuid();
    qb.insert('license_tokens', {
      id,
      license_key: data.license_key,
      token: data.token,
      machine_fingerprint: data.machine_fingerprint,
      stable_fingerprint: data.stable_fingerprint || null,
      activated_at: now,
      last_refreshed_at: now,
      created_at: now,
      updated_at: now,
    });

    return this.getCurrent()!;
  }

  updateToken(token: string) {
    const current = qb.selectOne('license_tokens', '*', undefined, []) as LicenseToken | undefined;
    if (!current) return;

    qb.update('license_tokens', {
      token,
      updated_at: new Date().toISOString(),
    }, 'id = ?', [current.id]);
  }

  updateLastRefreshed() {
    const current = qb.selectOne('license_tokens', '*', undefined, []) as LicenseToken | undefined;
    if (!current) return;

    qb.update('license_tokens', {
      last_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, 'id = ?', [current.id]);
  }

  updateFingerprints(machineFingerprint: string, stableFingerprint: string) {
    const current = qb.selectOne('license_tokens', '*', undefined, []) as LicenseToken | undefined;
    if (!current) return;

    qb.update('license_tokens', {
      machine_fingerprint: machineFingerprint,
      stable_fingerprint: stableFingerprint,
      updated_at: new Date().toISOString(),
    }, 'id = ?', [current.id]);
  }

  updateGtinToken(gtinToken: string, expiresAt: string) {
    const current = qb.selectOne('license_tokens', '*', undefined, []) as LicenseToken | undefined;
    if (!current) return;

    qb.update('license_tokens', {
      gtin_token: gtinToken,
      gtin_token_expires: expiresAt,
      updated_at: new Date().toISOString(),
    }, 'id = ?', [current.id]);
  }

  getGtinToken(): { token: string; expires: string } | null {
    const current = qb.selectOne('license_tokens', 'gtin_token, gtin_token_expires', undefined, []) as any;
    if (!current?.gtin_token || !current?.gtin_token_expires) return null;
    return { token: current.gtin_token, expires: current.gtin_token_expires };
  }

  clear() {
    const current = qb.selectOne('license_tokens', '*', undefined, []) as LicenseToken | undefined;
    if (!current) return;
    qb.delete('license_tokens', 'id = ?', [current.id]);
  }
}

export const licenseModel = new LicenseModel();
