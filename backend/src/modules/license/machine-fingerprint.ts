import os from 'os';
import crypto from 'crypto';

export function getMachineFingerprint(): string {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || '',
    os.networkInterfaces()
      ? Object.values(os.networkInterfaces())
          .flat()
          .filter((item) => item && !item.internal && item.mac && item.mac !== '00:00:00:00:00:00')
          .map((item) => item!.mac)
          .sort()
          .join('|')
      : '',
  ].join('::');

  return crypto.createHash('sha256').update(raw).digest('hex');
}
