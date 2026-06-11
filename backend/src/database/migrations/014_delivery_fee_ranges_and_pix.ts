import { DatabaseWrapper } from '../../config/database';

export async function up(db: DatabaseWrapper): Promise<void> {
  const defaults: Record<string, string> = {
    pix_key: '',
    payment_methods: JSON.stringify([
      { id: 'cash', label: 'Dinheiro', icon: '1', enabled: true, order: 1 },
      { id: 'credit_card', label: 'Cartão de Crédito', icon: '2', enabled: true, order: 2 },
      { id: 'debit_card', label: 'Cartão de Débito', icon: '3', enabled: true, order: 3 },
      { id: 'pix', label: 'PIX', icon: '4', enabled: true, order: 4 },
      { id: 'voucher', label: 'Vale', icon: '5', enabled: true, order: 5 },
    ]),
    delivery_fee_ranges: JSON.stringify([
      { from: '00:00', to: '12:00', fee: 5.00 },
      { from: '12:00', to: '23:59', fee: 8.00 },
    ]),
  };

  for (const [key, value] of Object.entries(defaults)) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}
