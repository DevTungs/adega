import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  db.run(`
    ALTER TABLE license_tokens ADD COLUMN stable_fingerprint TEXT
  `);
}
