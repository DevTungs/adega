import { printer as ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';
import { logger } from '../../shared/middlewares/logger';
import { getDb } from '../../config/database';

class PrinterService {
  private printer: any = null;
  private connected = false;

  private getSettings() {
    const db = getDb();
    const rows = db.all('SELECT key, value FROM settings WHERE key LIKE ?', ['printer_%']);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return {
      type: settings.printer_type || 'usb',
      interface: settings.printer_interface || 'USB',
      ip: settings.printer_ip || '',
      port: parseInt(settings.printer_port || '9100'),
      width: parseInt(settings.printer_width || '48'),
    };
  }

  private getStoreSettings() {
    const db = getDb();
    const rows = db.all('SELECT key, value FROM settings WHERE key LIKE ?', ['store_%']);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return {
      name: settings.store_name || 'ADEGA',
      address: settings.store_address || '',
      phone: settings.store_phone || '',
    };
  }

  private async initPrinter(): Promise<boolean> {
    try {
      const config = this.getSettings();
      const iface = config.type === 'network'
        ? `tcp://${config.ip}:${config.port}`
        : (config.interface || 'USB');

      this.printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: iface,
        width: config.width,
        characterSet: CharacterSet.PC860_PORTUGUESE,
      });

      this.connected = await this.printer.isPrinterConnected();
      return this.connected;
    } catch (err: any) {
      logger.error({ error: err.message }, 'Printer init failed');
      this.connected = false;
      return false;
    }
  }

  async printOrder(order: any): Promise<boolean> {
    const store = this.getStoreSettings();

    logger.info({
      orderNumber: order.order_number,
      total: order.total,
      items: order.items?.length || 0,
    }, 'Printing order');

    try {
      const ok = await this.initPrinter();
      if (!ok) {
        logger.warn('Printer not connected - logging ticket only');
        this.logTicket(order, store);
        return false;
      }

      const p = this.printer;

      // Header
      p.alignCenter();
      p.bold(true);
      p.setTextSize(1, 1);
      p.println(store.name);
      p.bold(false);
      p.setTextSize(0, 0);
      if (store.address) p.println(store.address);
      if (store.phone) p.println(store.phone);
      p.drawLine();

      // Order info
      p.alignLeft();
      p.bold(true);
      p.println(`Pedido #${order.order_number}`);
      p.bold(false);
      p.println(`Data: ${new Date(order.created_at).toLocaleString('pt-BR')}`);
      p.println(`Cliente: ${order.customer_name || 'N/A'}`);
      if (order.customer_phone) p.println(`Tel: ${order.customer_phone}`);
      p.drawLine();

      // Items
      p.bold(true);
      p.println('ITENS:');
      p.bold(false);

      if (order.items) {
        for (const item of order.items) {
          const name = item.product_name || 'Produto';
          const qty = item.quantity;
          const price = (item.unit_price * qty).toFixed(2);
          p.println(`${qty}x ${name}`);
          p.alignRight();
          p.println(`R$ ${price}`);
          p.alignLeft();
        }
      }

      p.drawLine();

      // Totals
      p.alignRight();
      p.println(`Subtotal: R$ ${Number(order.subtotal).toFixed(2)}`);
      if (order.discount > 0) p.println(`Desconto: -R$ ${Number(order.discount).toFixed(2)}`);
      if (order.delivery_fee > 0) p.println(`Entrega: R$ ${Number(order.delivery_fee).toFixed(2)}`);
      p.bold(true);
      p.setTextSize(1, 1);
      p.println(`TOTAL: R$ ${Number(order.total).toFixed(2)}`);
      p.setTextSize(0, 0);
      p.bold(false);
      p.alignLeft();

      p.drawLine();

      // Payment & Delivery
      if (order.payment_method) p.println(`Pagamento: ${this.formatPayment(order.payment_method)}`);
      if (order.delivery_address) {
        p.println('Endereco:');
        p.println(order.delivery_address);
      }
      if (order.notes) {
        p.println(`Obs: ${order.notes}`);
      }

      p.drawLine();
      p.alignCenter();
      p.println('Obrigado pela preferencia!');
      p.println('');
      p.println('');
      p.cut();

      await p.execute();
      logger.info({ orderNumber: order.order_number }, 'Order printed');
      return true;

    } catch (err: any) {
      logger.error({ error: err.message }, 'Print failed');
      this.logTicket(order, store);
      return false;
    }
  }

  private logTicket(order: any, store: any): void {
    const lines = [
      '================================',
      `  ${store.name}`,
      '================================',
      `  PEDIDO #${order.order_number}`,
      `  ${new Date(order.created_at).toLocaleString('pt-BR')}`,
      `  Cliente: ${order.customer_name || 'N/A'}`,
      '================================',
    ];

    if (order.items) {
      for (const item of order.items) {
        lines.push(`  ${item.quantity}x ${item.product_name}  R$ ${(item.unit_price * item.quantity).toFixed(2)}`);
      }
    }

    lines.push('--------------------------------');
    lines.push(`  TOTAL: R$ ${Number(order.total).toFixed(2)}`);
    lines.push('================================');

    logger.info({ ticket: lines.join('\n') }, 'Ticket (printer not connected)');
  }

  private formatPayment(method: string): string {
    const map: Record<string, string> = {
      cash: 'Dinheiro',
      credit_card: 'Cartao Credito',
      debit_card: 'Cartao Debito',
      pix: 'PIX',
      voucher: 'Vale',
    };
    return map[method] || method;
  }

  async checkPrinter(): Promise<boolean> {
    try {
      const ok = await this.initPrinter();
      return ok;
    } catch {
      return false;
    }
  }
}

export const printerService = new PrinterService();
