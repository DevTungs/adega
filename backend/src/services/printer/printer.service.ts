import {
  printer as ThermalPrinter,
  PrinterTypes,
  CharacterSet,
} from 'node-thermal-printer';

import { execSync } from 'child_process';
import { logger } from '../../shared/middlewares/logger';
import { getDb } from '../../config/database';

class PrinterService {
  private printer: any = null;
  private connected = false;

  private readonly PAPER_WIDTH = 48;

  // =========================================================
  // SETTINGS
  // =========================================================

  private getSettings() {
    const db = getDb();

    const rows = db.all(
      'SELECT key, value FROM settings WHERE key LIKE ?',
      ['printer_%']
    );

    const settings: Record<string, string> = {};

    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return {
      type: settings.printer_type || 'usb',
      ip: settings.printer_ip || '',
      port: parseInt(settings.printer_port || '9100'),
      width: parseInt(settings.printer_width || '48'),
      printerName: settings.printer_name || '',
    };
  }

  private getStoreSettings() {
    const db = getDb();

    const rows = db.all(
      'SELECT key, value FROM settings WHERE key LIKE ?',
      ['store_%']
    );

    const settings: Record<string, string> = {};

    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return {
      name: settings.store_name || 'LOJA',
      document: settings.store_document || '',
      ie: settings.store_ie || '',
      im: settings.store_im || '',
      address: settings.store_address || '',
      phone: settings.store_phone || '',
    };
  }

  // =========================================================
  // HELPERS
  // =========================================================

  private hr(char = '-') {
    return char.repeat(this.PAPER_WIDTH);
  }

  private hrDouble() {
    return '='.repeat(this.PAPER_WIDTH);
  }

  private center(text: string) {
    if (!text) return '';

    if (text.length >= this.PAPER_WIDTH) {
      return text;
    }

    const spaces = Math.floor(
      (this.PAPER_WIDTH - text.length) / 2
    );

    return ' '.repeat(spaces) + text;
  }

  private truncate(text: string, size: number) {
    if (!text) return '';

    return text.length > size
      ? `${text.substring(0, size - 3)}...`
      : text;
  }

  private money(value: number) {
    return 'R$ ' + Number(value || 0)
      .toFixed(2)
      .replace('.', ',');
  }

  private moneyRaw(value: number) {
    return Number(value || 0)
      .toFixed(2)
      .replace('.', ',');
  }

  private row(left: string, right: string) {
    const space =
      this.PAPER_WIDTH -
      left.length -
      right.length;

    return (
      left +
      ' '.repeat(Math.max(1, space)) +
      right
    );
  }

  private totalLine(
    label: string,
    value: number
  ) {
    return this.row(
      label,
      this.moneyRaw(value)
    );
  }

  private itemLine(item: any, index: number) {
    const code = String(index).padStart(3, '0');
    const qty = Number(item.quantity || 0);
    const unit = item.unit || 'UN';
    const unitPrice = Number(item.unit_price || 0);
    const total = qty * unitPrice;

    // Line 1: CODE DESCRIPTION
    const desc = this.truncate(
      item.product_name || 'PRODUTO',
      this.PAPER_WIDTH - code.length - 2
    );
    const line1 = `${code} ${desc}`;

    // Line 2: QTD x UNIT = TOTAL (indented)
    const detail = `${qty.toFixed(3).replace('.', ',')} ${unit} X ${this.moneyRaw(unitPrice)}`;
    const line2 = `   ${this.row(detail, this.moneyRaw(total))}`;

    return line1 + '\n' + line2;
  }

  private formatPayment(method: string) {
    const map: Record<string, string> = {
      cash: 'Dinheiro',
      credit_card: 'Cartao de Credito',
      debit_card: 'Cartao de Debito',
      pix: 'PIX',
      voucher: 'Vale',
    };

    return map[method] || method.toUpperCase();
  }

  private formatCPF(value: string) {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (digits.length === 14) {
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return value;
  }

  // =========================================================
  // PRINTERS
  // =========================================================

  getAvailablePrinters(): string[] {
    try {
      const result = execSync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
        {
          encoding: 'utf-8',
          timeout: 10000,
        }
      );

      return result
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

    } catch (err: any) {
      logger.error(
        { error: err.message },
        'Failed to list printers'
      );

      return [];
    }
  }

  // =========================================================
  // INIT
  // =========================================================

  private async initPrinter(): Promise<boolean> {
    try {
      const config = this.getSettings();

      if (config.type === 'network') {
        this.printer = new ThermalPrinter({
          type: PrinterTypes.EPSON,
          interface: `tcp://${config.ip}:${config.port}`,
          width: config.width,
          characterSet: CharacterSet.PC860_PORTUGUESE,
          removeSpecialCharacters: false,
          lineCharacter: '-',
        });

        this.connected =
          await this.printer.isPrinterConnected();

        return this.connected;
      }

      if (!config.printerName) {
        logger.warn('No printer configured');
        return false;
      }

      this.printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `printer:${config.printerName}`,
        width: config.width,
        characterSet: CharacterSet.PC860_PORTUGUESE,
        removeSpecialCharacters: false,
        lineCharacter: '-',
      });

      this.connected =
        await this.printer.isPrinterConnected();

      return this.connected;

    } catch (err: any) {
      logger.error(
        { error: err.message },
        'Printer initialization failed'
      );

      return false;
    }
  }

  // =========================================================
  // WINDOWS DRIVER
  // =========================================================

  private getWindowsDriver() {
    return {
      getPrinters: () => {
        try {
          const result = execSync(
            'powershell -NoProfile -Command "Get-Printer | Select-Object Name | ConvertTo-Json"',
            {
              encoding: 'utf-8',
              timeout: 10000,
            }
          );

          const printers = JSON.parse(result);

          const list = Array.isArray(printers)
            ? printers
            : [printers];

          return list.map((p: any) => ({
            name: p.Name,
            isDefault: false,
          }));

        } catch {
          return [];
        }
      },

      getPrinter: (name: string) => ({
        name,
        status: 'IDLE',
      }),

      printDirect: (options: any) => {
        try {
          const printerName =
            options.printer || options.printerName;

          if (!printerName) {
            throw new Error('Printer not defined');
          }

          const fs = require('fs');
          const path = require('path');

          // options.data is a Buffer with ESC/POS binary commands
          // Write to temp file as raw bytes, then use PowerShell to send directly to printer port
          const tmpFile = path.join(
            process.env.TEMP || '/tmp',
            `ticket_${Date.now()}.bin`
          );

          fs.writeFileSync(tmpFile, options.data);

          // Send raw ESC/POS bytes to Windows printer via PrintQueue
          // This bypasses GDI DrawString and sends binary commands directly
          const escapedPrinter = printerName.replace(/'/g, "''");
          const escapedFile = tmpFile.replace(/'/g, "''");

          // Write a PowerShell script to temp file to avoid escaping issues
          const psFile = path.join(
            process.env.TEMP || '/tmp',
            `print_${Date.now()}.ps1`
          );

          const psScript = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Printing
$printerName = '${escapedPrinter}'
$file = '${escapedFile}'

$printServer = New-Object System.Printing.PrintServer
$queue = $printServer.GetPrintQueues() | Where-Object { $_.Name -eq $printerName } | Select-Object -First 1
if (-not $queue) { throw "Printer '$printerName' not found" }

$bytes = [System.IO.File]::ReadAllBytes($file)
$job = $queue.AddJob('Ticket')
$stream = $job.JobStream
$stream.Write($bytes, 0, $bytes.Length)
$stream.Close()
`.trim();

          fs.writeFileSync(psFile, psScript, 'utf-8');

          try {
            execSync(
              `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile.replace(/"/g, '""')}"`,
              {
                encoding: 'utf-8',
                timeout: 30000,
              }
            );
          } finally {
            try { fs.unlinkSync(psFile); } catch {}
          }

          try {
            fs.unlinkSync(tmpFile);
          } catch {}

          if (options.success) {
            options.success();
          }

        } catch (err: any) {
          logger.error(
            { error: err.message },
            'Direct print failed'
          );

          if (options.error) {
            options.error(err.message);
          }
        }
      },
    };
  }

  // =========================================================
  // PRINT ORDER — CUPOM NAO FISCAL
  // =========================================================

  async printOrder(order: any): Promise<boolean> {
    const store = this.getStoreSettings();

    logger.info(
      {
        order: order.order_number,
        total: order.total,
      },
      'Printing cupom'
    );

    try {
      const connected = await this.initPrinter();

      if (!connected) {
        this.logTicket(order, store);
        return false;
      }

      const p = this.printer;

      // =====================================================
      // CABECALHO — DADOS DO ESTABELECIMENTO
      // =====================================================

      p.alignCenter();

      p.setTextSize(1, 1);
      p.bold(true);
      p.println(store.name.toUpperCase());
      p.bold(false);
      p.setTextSize(0, 0);

      if (store.document) {
        p.println(`CNPJ: ${this.formatCPF(store.document)}`);
      }

      if (store.ie) {
        p.println(`IE: ${store.ie}`);
      }

      if (store.im) {
        p.println(`IM: ${store.im}`);
      }

      if (store.address) {
        p.println(store.address);
      }

      if (store.phone) {
        p.println(`Tel: ${store.phone}`);
      }

      p.println(this.hr());

      // =====================================================
      // TIPO DE DOCUMENTO
      // =====================================================

      p.bold(true);
      p.setTextSize(0, 1);
      p.println('CUPOM NAO FISCAL');
      p.setTextSize(0, 0);
      p.bold(false);

      p.println(this.hr());

      // =====================================================
      // DADOS DO PEDIDO
      // =====================================================

      p.alignLeft();

      p.println(this.row('Pedido N.:', String(order.order_number).padStart(6, '0')));
      p.println(this.row('Data:', new Date(order.created_at).toLocaleString('pt-BR')));

      if (order.order_type) {
        const tipo = order.order_type === 'delivery' ? 'DELIVERY' : 'BALCAO';
        p.println(this.row('Tipo:', tipo));
      }

      // =====================================================
      // DADOS DO CLIENTE
      // =====================================================

      if (order.customer_name || order.customer_phone) {
        p.println(this.hr('-'));

        if (order.customer_name) {
          p.println(this.row('Cliente:', this.truncate(order.customer_name, 30)));
        }

        if (order.customer_phone) {
          p.println(this.row('Tel:', order.customer_phone));
        }

        if (order.delivery_address) {
          p.println('End: ' + this.truncate(order.delivery_address, this.PAPER_WIDTH - 5));
        }
      }

      p.println(this.hr());

      // =====================================================
      // ITENS
      // =====================================================

      p.bold(true);
      p.println(this.row('COD  DESCRICAO', 'VALOR'));
      p.bold(false);

      p.println(this.hr('-'));

      const items = order.items || [];
      for (let i = 0; i < items.length; i++) {
        p.println(this.itemLine(items[i], i + 1));
      }

      p.println(this.hr('='));

      // =====================================================
      // TOTAIS
      // =====================================================

      const subtotal = Number(order.subtotal || 0);
      const discount = Number(order.discount || 0);
      const deliveryFee = Number(order.delivery_fee || 0);
      const total = Number(order.total || 0);

      p.println(this.totalLine('SUBTOTAL', subtotal));

      if (discount > 0) {
        p.println(this.totalLine('DESCONTO (-)', discount));
      }

      if (deliveryFee > 0) {
        p.println(this.totalLine('TAXA ENTREGA', deliveryFee));
      }

      p.println(this.hr('='));

      p.bold(true);
      p.setTextSize(0, 1);
      p.println(this.row('TOTAL:', this.moneyRaw(total)));
      p.setTextSize(0, 0);
      p.bold(false);

      p.println(this.hr('='));

      // =====================================================
      // PAGAMENTO
      // =====================================================

      if (order.payment_method) {
        p.println(this.row('Forma Pgto:', this.formatPayment(order.payment_method)));
      }

      const paidAmount = Number(order.paid_amount || total);
      const change = Number(order.change || 0);

      if (order.payment_method === 'cash' && paidAmount > 0) {
        p.println(this.row('Valor Pago:', this.moneyRaw(paidAmount)));
        if (change > 0) {
          p.println(this.row('Troco:', this.moneyRaw(change)));
        }
      }

      p.println(this.hr());

      // =====================================================
      // OBSERVACOES
      // =====================================================

      if (order.notes) {
        p.println('');
        p.bold(true);
        p.println('Observacoes:');
        p.bold(false);
        p.println(this.truncate(order.notes, this.PAPER_WIDTH));
        p.println(this.hr());
      }

      // =====================================================
      // RODAPE
      // =====================================================

      p.alignCenter();

      p.println('');
      p.println('Obrigado pela preferencia!');
      p.println('Volte sempre :)');
      p.println('');

      p.println(this.hr());
      p.println(new Date().toLocaleString('pt-BR'));
      p.println(`Pedido #${order.order_number}`);
      p.println('');

      p.println('');
      p.println('');

      p.cut();

      await p.execute();

      logger.info(
        {
          order: order.order_number,
        },
        'Cupom printed successfully'
      );

      return true;

    } catch (err: any) {
      logger.error(
        { error: err.message },
        'Print failed'
      );

      this.logTicket(order, store);

      return false;
    }
  }

  // =========================================================
  // FALLBACK LOG
  // =========================================================

  private logTicket(order: any, store: any) {
    const lines = [
      this.hr('='),
      this.center(store.name.toUpperCase()),
      this.center('CUPOM NAO FISCAL'),
      this.hr('='),
      `Pedido: ${order.order_number}`,
      `Data: ${new Date(order.created_at).toLocaleString('pt-BR')}`,
      this.hr('-'),
    ];

    for (const item of order.items || []) {
      lines.push(`${item.quantity}x ${item.product_name} ... ${this.money(item.unit_price * item.quantity)}`);
    }

    lines.push(this.hr('='));
    lines.push(`TOTAL: ${this.money(order.total)}`);
    lines.push(this.hr('='));

    logger.info(
      {
        ticket: lines.join('\n'),
      },
      'Ticket fallback'
    );
  }

  // =========================================================
  // STATUS
  // =========================================================

  async checkPrinter(): Promise<{
    connected: boolean;
    printers: string[];
  }> {
    const printers =
      this.getAvailablePrinters();

    try {
      const connected =
        await this.initPrinter();

      return {
        connected,
        printers,
      };

    } catch {
      return {
        connected: false,
        printers,
      };
    }
  }
}

export const printerService = new PrinterService();
