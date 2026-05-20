import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // Insert default settings
  const defaults = {
    store_name: 'Adega',
    store_address: '',
    store_phone: '',
    opening_hours: 'Seg-Sáb: 09:00-22:00',
    delivery_fee: '5.00',
    min_order: '20.00',
    delivery_radius: '5',
    printer_type: 'usb',
    printer_interface: 'USB',
    printer_ip: '',
    printer_port: '9100',
    printer_width: '48',
    notify_sound: 'true',
    notify_orders: 'true',
    notify_whatsapp: 'false',
  };

  for (const [key, value] of Object.entries(defaults)) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}
