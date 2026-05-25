import fs from 'fs';
import path from 'path';
import { logger } from '../../shared/middlewares/logger';

export class BackupService {
  private backupDir = path.resolve(__dirname, '../../../data/backups');
  private dbPath = path.resolve(__dirname, '../../../data/delivery.db');

  constructor() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `backup-${timestamp}.db`);

    try {
      fs.copyFileSync(this.dbPath, backupFile);
      logger.info({ backupFile }, 'Backup created');
      this.cleanOldBackups();
      return backupFile;
    } catch (err: any) {
      logger.error({ error: err.message }, 'Backup failed');
      throw err;
    }
  }

  private cleanOldBackups(): void {
    const keepCount = parseInt(process.env.BACKUP_KEEP_COUNT || '30');
    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .sort()
      .reverse();

    for (const old of files.slice(keepCount)) {
      fs.unlinkSync(path.join(this.backupDir, old));
      logger.info({ file: old }, 'Old backup removed');
    }
  }

  async listBackups(): Promise<string[]> {
    return fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith('backup-'))
      .sort()
      .reverse();
  }

  async restoreBackup(backupFile: string): Promise<void> {
    const backupPath = path.join(this.backupDir, backupFile);
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }
    fs.copyFileSync(backupPath, this.dbPath);
    logger.info({ backupFile }, 'Backup restored');
  }

  // Auto backup schedule (called from cron or interval)
  startAutoBackup(intervalHours: number = 24) {
    setInterval(() => {
      this.createBackup().catch(err => {
        logger.error({ error: err.message }, 'Auto backup failed');
      });
    }, intervalHours * 60 * 60 * 1000);
  }
}

export const backupService = new BackupService();
