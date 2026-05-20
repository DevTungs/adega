import { WhatsAppSession } from '../../shared/types';
import { productsService } from '../../modules/products/products.service';
import { customersModel } from '../../modules/customers/customers.model';
import { ordersModel } from '../../modules/orders/orders.model';
import { SYSTEM_PROMPT } from './ai.prompts';
import { logger } from '../../shared/middlewares/logger';

export async function buildAIContext(session: WhatsAppSession, message: string) {
  const catalog = await productsService.getCatalog();
  const context = JSON.parse(session.context || '{}');

  logger.info({
    catalogCategories: catalog.length,
    totalProducts: catalog.reduce((acc, cat) => acc + cat.products.length, 0),
  }, '[AI] Catalog loaded');

  let customerName = 'Não informado';
  let orderCount = 0;
  let activeOrdersText = 'Nenhum pedido ativo.';

  if (session.customer_id) {
    const customer = await customersModel.findById(session.customer_id);
    if (customer) {
      customerName = customer.name || 'Não informado';
      orderCount = customer.total_orders;

      // Fetch active orders for this customer
      const activeOrders = ordersModel.getActiveOrdersByCustomer(session.customer_id);
      if (activeOrders.length > 0) {
        activeOrdersText = activeOrders.map((o: any) => {
          const items = (o.items || []).map((i: any) => `  - ${i.quantity}x ${i.product_name}`).join('\n');
          return `Pedido #${o.order_number} - Status: ${o.status}\n${items}`;
        }).join('\n\n');
      }
    }
  }

  const catalogText = catalog
    .map((cat: any) => {
      const products = cat.products
        .map((p: any) => `- ${p.name} (ID: ${p.id}) - R$ ${(p.promo_price || p.price).toFixed(2)}${p.volume ? ` ${p.volume}` : ''}`)
        .join('\n');
      return `[${cat.name}]\n${products}`;
    })
    .join('\n\n');

  const promotionsText = 'Nenhuma promoção ativa no momento.';

  const systemPrompt = SYSTEM_PROMPT
    .replace('{{CATALOG}}', catalogText)
    .replace('{{PROMOTIONS}}', promotionsText)
    .replace('{{CUSTOMER_NAME}}', customerName)
    .replace('{{ORDER_COUNT}}', String(orderCount))
    .replace('{{ACTIVE_ORDERS}}', activeOrdersText);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(context.history || []).slice(-6), // Last 6 messages for context
    { role: 'user' as const, content: message },
  ];

  return { messages, catalog, context };
}
