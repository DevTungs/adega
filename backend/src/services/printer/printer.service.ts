import { printer as ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';
import { execSync } from 'child_process';
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
      printerName: settings.printer_name || '',
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
      name: settings.store_name || 'Loja',
      address: settings.store_address || '',
      phone: settings.store_phone || '',
    };
  }

  /**
   * List available printers on Windows using PowerShell/WMI
   */
  getAvailablePrinters(): string[] {
    try {
      const result = execSync(
        'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
        { encoding: 'utf-8', timeout: 10000 }
      );
      return result.split('\n').map(s => s.trim()).filter(Boolean);
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to list printers');
      return [];
    }
  }

  private async initPrinter(): Promise<boolean> {
    try {
      const config = this.getSettings();

      if (config.type === 'network') {
        // Network printer via TCP
        const iface = `tcp://${config.ip}:${config.port}`;
        this.printer = new ThermalPrinter({
          type: PrinterTypes.EPSON,
          interface: iface,
          width: config.width,
          characterSet: CharacterSet.PC860_PORTUGUESE,
        });
        this.connected = await this.printer.isPrinterConnected();
        return this.connected;
      }

      // USB/local printer via Windows print subsystem
      if (!config.printerName) {
        logger.warn('No printer name configured - set printer_name in settings');
        this.connected = false;
        return false;
      }

      this.printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `printer:${config.printerName}`,
        driver: this.getWindowsDriver(),
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

  private shouldUseWindowsTextPrint(printerName: string): boolean {
    const name = printerName.toLowerCase();
    return name.includes('microsoft print to pdf') || name.includes('pdf') || name.includes('xps');
  }

  /**
   * Windows printer driver using PowerShell/.NET
   */
  private getWindowsDriver() {
    return {
      getPrinters: () => {
        try {
          const result = execSync(
            'powershell -NoProfile -Command "Get-Printer | Select-Object Name, PrinterStatus, Type | ConvertTo-Json"',
            { encoding: 'utf-8', timeout: 10000 }
          );
          const printers = JSON.parse(result);
          const list = Array.isArray(printers) ? printers : [printers];
          return list.map((p: any) => ({
            name: p.Name,
            isDefault: false,
            attributes: 'RAW-ONLY',
            options: {
              'printer-make-and-model': '',
              'system_driver': '',
              'printer-state': p.PrinterStatus === 0 ? '3' : '4',
              'printer-location': '',
              'printer-info': p.Name,
              'raw_only': true,
            },
          }));
        } catch (err: any) {
          logger.error({ error: err.message }, 'Failed to enumerate printers');
          return [];
        }
      },
      getPrinter: (name: string) => {
        return {
          name,
          status: 'IDLE',
          attributes: 'RAW-ONLY',
        };
      },
      printDirect: (options: any) => {
        try {
          const printerName = options.printer || options.printerName;
          if (!printerName) throw new Error('No printer name specified');

          const fs = require('fs');
          const path = require('path');
          const tmpFile = path.join(process.env.TEMP || '/tmp', `print_${Date.now()}.prn`);
          fs.writeFileSync(tmpFile, options.data);

          // Write PS1 script to temp file to avoid here-string escaping issues
          const psFile = path.join(process.env.TEMP || '/tmp', `raw_${Date.now()}.ps1`);
          const psScript = `$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static void SendBytesToPrinter(string szPrinterName, string szFileName) {
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        int dwWritten = 0;
        di.pDocName = "Order";
        di.pDataType = "RAW";
        byte[] bytes = File.ReadAllBytes(szFileName);
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
        try {
            if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "OpenPrinter failed");
            }
            if (!StartDocPrinter(hPrinter, 1, di)) {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "StartDocPrinter failed");
            }
            if (!StartPagePrinter(hPrinter)) {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "StartPagePrinter failed");
            }
            if (!WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten)) {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "WritePrinter failed");
            }
            if (dwWritten != bytes.Length) {
                throw new Exception("WritePrinter wrote " + dwWritten + " of " + bytes.Length + " bytes");
            }
            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
        } finally {
            if (hPrinter != IntPtr.Zero) ClosePrinter(hPrinter);
            Marshal.FreeCoTaskMem(pUnmanagedBytes);
        }
    }
}
"@
try {
    [RawPrinter]::SendBytesToPrinter('${printerName.replace(/'/g, "''")}', '${tmpFile.replace(/'/g, "''")}')
    Write-Output 'OK'
} catch {
    Write-Error $_.Exception.Message
} finally {
    Start-Sleep 1
    Remove-Item '${tmpFile.replace(/'/g, "''")}' -Force -EA SilentlyContinue
}`;

          fs.writeFileSync(psFile, psScript, { encoding: 'utf-8' });

          try {
            execSync(
              `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`,
              { encoding: 'utf-8', timeout: 30000 }
            );
          } finally {
            try { fs.unlinkSync(psFile); } catch {}
          }

          if (options.success) options.success();
        } catch (err: any) {
          logger.error({ error: err.message }, 'Print direct failed');
          if (options.error) options.error(err.message);
        }
      },
    };
  }

  async printOrder(order: any): Promise<boolean> {
    const store = this.getStoreSettings();
    const config = this.getSettings();

    logger.info({
      orderNumber: order.order_number,
      total: order.total,
      items: order.items?.length || 0,
      printerType: config.type,
      printerName: config.printerName || undefined,
      printerIp: config.ip || undefined,
    }, 'Printing order');

    try {
      const ok = await this.initPrinter();
      if (!ok) {
        logger.warn('Printer not connected - logging ticket only');
        this.logTicket(order, store);
        return false;
      }

      const p = this.printer;

      if (config.type !== 'network' && this.shouldUseWindowsTextPrint(config.printerName)) {
        this.printOrderAsWindowsText(order, store, config.printerName);
        logger.info({ orderNumber: order.order_number }, 'Order printed');
        return true;
      }

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

  private printOrderAsWindowsText(order: any, store: any, printerName: string): void {
    const fs = require('fs');
    const path = require('path');
    const tmpDir = process.env.TEMP || '/tmp';
    const textFile = path.join(tmpDir, `ticket_${Date.now()}.txt`);
    const psFile = path.join(tmpDir, `text_print_${Date.now()}.ps1`);
    const ticket = this.buildTextTicket(order, store);

    fs.writeFileSync(textFile, ticket, { encoding: 'utf-8' });

    const psScript = `$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$printerName = '${printerName.replace(/'/g, "''")}'
$text = [System.IO.File]::ReadAllText('${textFile.replace(/'/g, "''")}')
$font = New-Object System.Drawing.Font('Consolas', 10)
$brush = [System.Drawing.Brushes]::Black
$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $printerName
if (-not $doc.PrinterSettings.IsValid) { throw "Invalid printer: $printerName" }
$doc.add_PrintPage({
  param($sender, $eventArgs)
  $eventArgs.Graphics.DrawString($text, $font, $brush, 20, 20)
  $eventArgs.HasMorePages = $false
})
try {
  $doc.Print()
} finally {
  $font.Dispose()
  $doc.Dispose()
  Remove-Item '${textFile.replace(/'/g, "''")}' -Force -EA SilentlyContinue
}`;

    fs.writeFileSync(psFile, psScript, { encoding: 'utf-8' });
    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile}"`, { encoding: 'utf-8', timeout: 30000 });
    } finally {
      try { fs.unlinkSync(psFile); } catch {}
    }
  }

  private buildTextTicket(order: any, store: any): string {
    const lines = [
      '================================',
      `  ${store.name}`,
      '================================',
      `  PEDIDO #${order.order_number}`,
      `  ${new Date(order.created_at).toLocaleString('pt-BR')}`,
      `  Cliente: ${order.customer_name || 'N/A'}`,
    ];

    if (order.customer_phone) lines.push(`  Tel: ${order.customer_phone}`);
    lines.push('================================');

    if (order.items) {
      for (const item of order.items) {
        lines.push(`  ${item.quantity}x ${item.product_name}`);
        lines.push(`  R$ ${(item.unit_price * item.quantity).toFixed(2)}`);
      }
    }

    lines.push('--------------------------------');
    lines.push(`  Subtotal: R$ ${Number(order.subtotal).toFixed(2)}`);
    if (order.discount > 0) lines.push(`  Desconto: -R$ ${Number(order.discount).toFixed(2)}`);
    if (order.delivery_fee > 0) lines.push(`  Entrega: R$ ${Number(order.delivery_fee).toFixed(2)}`);
    lines.push(`  TOTAL: R$ ${Number(order.total).toFixed(2)}`);

    if (order.payment_method) lines.push(`  Pagamento: ${this.formatPayment(order.payment_method)}`);
    if (order.delivery_address) {
      lines.push('  Endereco:');
      lines.push(`  ${order.delivery_address}`);
    }
    if (order.notes) lines.push(`  Obs: ${order.notes}`);

    lines.push('================================');
    lines.push('  Obrigado pela preferencia!');
    lines.push('================================');

    return `${lines.join('\n')}\n`;
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

  async checkPrinter(): Promise<{ connected: boolean; printers: string[] }> {
    const printers = this.getAvailablePrinters();
    try {
      const ok = await this.initPrinter();
      return { connected: ok, printers };
    } catch {
      return { connected: false, printers };
    }
  }
}

export const printerService = new PrinterService();
