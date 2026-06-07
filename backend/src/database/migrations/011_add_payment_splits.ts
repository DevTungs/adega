import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  db.run(`
    ALTER TABLE orders ADD COLUMN payment_splits TEXT DEFAULT '[]'
  `);
}
