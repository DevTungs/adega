import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  // Add whatsapp_jid column to customers table for linked device support
  db.run(`ALTER TABLE customers ADD COLUMN whatsapp_jid TEXT`);
  db.run('CREATE INDEX IF NOT EXISTS idx_customers_wa_jid ON customers(whatsapp_jid)');
}

export async function down(db: DatabaseWrapper): Promise<void> {
  db.run('DROP INDEX IF EXISTS idx_customers_wa_jid');
  // SQLite doesn't support DROP COLUMN in older versions, so we leave it
}
