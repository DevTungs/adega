import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  // Add order_type column to orders table
  try {
    db.run(`ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'delivery'`);
  } catch { /* column already exists */ }

  // Add index on barcode for faster lookups
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)');
  } catch { /* index already exists */ }

  // Update existing PDV orders based on customer_id
  try {
    db.run(`UPDATE orders SET order_type = 'pdv' WHERE customer_id = 'pdv-walk-in'`);
  } catch { /* ignore */ }

  // Add index on order_type for filtering
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type)');
  } catch { /* index already exists */ }
}
