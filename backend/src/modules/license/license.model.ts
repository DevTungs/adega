import { qb } from '../../config/database';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { License } from '../../shared/types';
import { getMachineFingerprint } from './machine-fingerprint';

const HMAC_SECRET = 'dlv-lic-2024-secure'; // Fixed pepper added to HMAC key

function computeHMAC(licenseKey: string, status: string, expiresAt: string | null, fingerprint: string): string {
  const data = `${licenseKey}|${status}|${expiresAt || ''}`;
  const key = `${fingerprint}::${HMAC_SECRET}`;
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

export class LicenseModel {
  getCurrent(): License | undefined {
    const row = qb.selectOne('licenses', '*', undefined, []) as License | undefined;
    if (!row) return undefined;

    // Verify HMAC integrity
    try {
      const meta = JSON.parse(row.metadata || '{}');
      if (meta.hmac) {
        const fingerprint = getMachineFingerprint();
        const expected = computeHMAC(row.license_key, row.status, row.expires_at, fingerprint);
        if (meta.hmac !== expected) {
          // Tampered — return with special status
          return { ...row, status: 'tampered' };
        }
      }
    } catch {
      // If metadata is corrupt, treat as tampered
      return { ...row, status: 'tampered' };
    }

    return row;
  }

  upsert(data: Partial<License> & { license_key: string; machine_fingerprint: string; status: string }): License {
    const current = qb.selectOne('licenses', '*', undefined, []) as License | undefined;
    const now = new Date().toISOString();

    // Compute HMAC of critical fields
    const fingerprint = getMachineFingerprint();
    const hmac = computeHMAC(data.license_key, data.status, data.expires_at || null, fingerprint);

    // Preserve existing metadata keys (like serverTime, graceUntil, canCreateOrders) and add hmac
    let existingMeta: Record<string, any> = {};
    try {
      existingMeta = current ? JSON.parse(current.metadata || '{}') : {};
    } catch { /* ignore */ }

    const metadata = JSON.stringify({
      ...existingMeta,
      ...(data.metadata ? JSON.parse(data.metadata) : {}),
      hmac,
    });

    if (current) {
      qb.update('licenses', {
        license_key: data.license_key,
        status: data.status,
        customer_name: data.customer_name || null,
        machine_fingerprint: data.machine_fingerprint,
        expires_at: data.expires_at || null,
        last_validated_at: data.last_validated_at || null,
        last_error: data.last_error || null,
        metadata,
        updated_at: now,
      }, 'id = ?', [current.id]);
      return this.getCurrent()!;
    }

    const id = data.id || uuid();
    qb.insert('licenses', {
      id,
      license_key: data.license_key,
      status: data.status,
      customer_name: data.customer_name || null,
      machine_fingerprint: data.machine_fingerprint,
      expires_at: data.expires_at || null,
      last_validated_at: data.last_validated_at || null,
      last_error: data.last_error || null,
      metadata,
      created_at: now,
      updated_at: now,
    });

    return this.getCurrent()!;
  }

  setError(message: string): License | undefined {
    const current = qb.selectOne('licenses', '*', undefined, []) as License | undefined;
    if (!current) return undefined;
    qb.update('licenses', {
      last_error: message,
      updated_at: new Date().toISOString(),
    }, 'id = ?', [current.id]);
    return this.getCurrent();
  }
}

export const licenseModel = new LicenseModel();
