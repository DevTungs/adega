import { DatabaseWrapper } from '../../config/database';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

export async function seed(db: DatabaseWrapper): Promise<void> {
  // Admin user
  const adminExists = db.get('SELECT 1 FROM admin_users WHERE username = ?', ['admin']);
  if (!adminExists) {
    db.insert('admin_users', {
      id: uuid(),
      username: 'admin',
      password_hash: bcrypt.hashSync('admin123', 10),
      name: 'Administrador',
      role: 'admin',
    });
  }

  // Categories
  const catCount = db.get('SELECT COUNT(*) as count FROM categories');
  if (catCount?.count > 0) return; // Already seeded

  const categories = [
    { id: uuid(), name: 'Cervejas', slug: 'cervejas', description: 'Cervejas nacionais e importadas', display_order: 1 },
    { id: uuid(), name: 'Vinhos', slug: 'vinhos', description: 'Vinhos tintos, brancos e rosés', display_order: 2 },
    { id: uuid(), name: 'Destilados', slug: 'destilados', description: 'Whisky, vodka, gin, rum', display_order: 3 },
    { id: uuid(), name: 'Sem Álcool', slug: 'sem-alcool', description: 'Refrigerantes, sucos, água', display_order: 4 },
    { id: uuid(), name: 'Petiscos', slug: 'petiscos', description: 'Salgados e aperitivos', display_order: 5 },
  ];

  for (const cat of categories) {
    db.insert('categories', cat);
  }

  // Products
  const products = [
    { id: uuid(), category_id: categories[0].id, name: 'Heineken 600ml', slug: 'heineken-600', price: 12.90, volume: '600ml', brand: 'Heineken', stock: 48, is_featured: 1 },
    { id: uuid(), category_id: categories[0].id, name: 'Heineken Long Neck', slug: 'heineken-long-neck', price: 8.90, volume: '330ml', brand: 'Heineken', stock: 72 },
    { id: uuid(), category_id: categories[0].id, name: 'Skol 600ml', slug: 'skol-600', price: 7.90, volume: '600ml', brand: 'Skol', stock: 48 },
    { id: uuid(), category_id: categories[0].id, name: 'Brahma 600ml', slug: 'brahma-600', price: 7.50, volume: '600ml', brand: 'Brahma', stock: 48 },
    { id: uuid(), category_id: categories[0].id, name: 'Stella Artois 330ml', slug: 'stella-330', price: 9.90, volume: '330ml', brand: 'Stella Artois', stock: 36 },
    { id: uuid(), category_id: categories[0].id, name: 'Corona 355ml', slug: 'corona-355', price: 10.90, volume: '355ml', brand: 'Corona', stock: 36 },
    { id: uuid(), category_id: categories[0].id, name: 'Colorado Appia 600ml', slug: 'colorado-appia', price: 14.90, volume: '600ml', brand: 'Colorado', stock: 24 },
    { id: uuid(), category_id: categories[0].id, name: 'IPA Wals 600ml', slug: 'ipa-wals', price: 18.90, volume: '600ml', brand: 'Wals', stock: 12 },
    { id: uuid(), category_id: categories[1].id, name: 'Vinho Tinto Reservado 750ml', slug: 'reservado-tinto', price: 29.90, volume: '750ml', brand: 'Reservado', stock: 24 },
    { id: uuid(), category_id: categories[1].id, name: 'Vinho Branco Chardonay 750ml', slug: 'chardonay-branco', price: 34.90, volume: '750ml', brand: 'Chardonay', stock: 18 },
    { id: uuid(), category_id: categories[1].id, name: 'Vinho Rosé 750ml', slug: 'rose-750', price: 27.90, volume: '750ml', brand: 'Rosé', stock: 12 },
    { id: uuid(), category_id: categories[1].id, name: 'Vinho Suave 750ml', slug: 'suave-750', price: 22.90, volume: '750ml', brand: 'Suave', stock: 18 },
    { id: uuid(), category_id: categories[2].id, name: 'Red Label 1L', slug: 'red-label-1l', price: 89.90, volume: '1L', brand: 'Johnnie Walker', stock: 12, is_featured: 1 },
    { id: uuid(), category_id: categories[2].id, name: 'Black Label 1L', slug: 'black-label-1l', price: 149.90, volume: '1L', brand: 'Johnnie Walker', stock: 6 },
    { id: uuid(), category_id: categories[2].id, name: 'Smirnoff Vodka 1L', slug: 'smirnoff-1l', price: 49.90, volume: '1L', brand: 'Smirnoff', stock: 12 },
    { id: uuid(), category_id: categories[2].id, name: 'Gin Tanqueray 750ml', slug: 'gin-tanqueray', price: 129.90, volume: '750ml', brand: 'Tanqueray', stock: 6 },
    { id: uuid(), category_id: categories[2].id, name: 'Cachaça 51 1L', slug: 'cachaca-51', price: 19.90, volume: '1L', brand: '51', stock: 24 },
    { id: uuid(), category_id: categories[3].id, name: 'Coca-Cola 2L', slug: 'coca-cola-2l', price: 10.90, volume: '2L', brand: 'Coca-Cola', stock: 36 },
    { id: uuid(), category_id: categories[3].id, name: 'Guaraná Antarctica 2L', slug: 'guarana-2l', price: 8.90, volume: '2L', brand: 'Antarctica', stock: 36 },
    { id: uuid(), category_id: categories[3].id, name: 'Água Mineral 500ml', slug: 'agua-500', price: 3.00, volume: '500ml', stock: 72 },
    { id: uuid(), category_id: categories[3].id, name: 'Suco Del Valle 1L', slug: 'del-valle-1l', price: 7.90, volume: '1L', brand: 'Del Valle', stock: 24 },
    { id: uuid(), category_id: categories[4].id, name: 'Amendoim 200g', slug: 'amendoim-200', price: 8.90, unit: 'un', stock: 30 },
    { id: uuid(), category_id: categories[4].id, name: 'Batata Frita', slug: 'batata-frita', price: 15.90, unit: 'un', stock: 50 },
    { id: uuid(), category_id: categories[4].id, name: 'Isca de Frango', slug: 'isca-frango', price: 18.90, unit: 'un', stock: 30 },
  ];

  for (const p of products) {
    db.insert('products', p);
  }

  // Product aliases
  const aliasMap: [string, string][] = [
    [products[0].id, 'heineken 600'], [products[0].id, 'heineken garrafa'],
    [products[1].id, 'heineken long'], [products[1].id, 'long neck heineken'], [products[1].id, 'heineken ln'],
    [products[2].id, 'skol 600'], [products[2].id, 'skol garrafa'],
    [products[3].id, 'brahma 600'], [products[3].id, 'brahma garrafa'],
    [products[4].id, 'stella'], [products[4].id, 'stella artois'],
    [products[5].id, 'corona'], [products[5].id, 'corona extra'],
    [products[6].id, 'colorado'], [products[6].id, 'appia'],
    [products[7].id, 'ipa'], [products[7].id, 'wals'],
    [products[8].id, 'reservado'], [products[8].id, 'vinho tinto'], [products[8].id, 'tinto'],
    [products[9].id, 'chardonay'], [products[9].id, 'vinho branco'],
    [products[10].id, 'rosé'], [products[10].id, 'vinho rosé'],
    [products[11].id, 'vinho suave'],
    [products[12].id, 'red label'], [products[12].id, 'red'], [products[12].id, 'johnnie red'],
    [products[13].id, 'black label'], [products[13].id, 'black'], [products[13].id, 'johnnie black'],
    [products[14].id, 'smirnoff'], [products[14].id, 'vodka'],
    [products[15].id, 'gin'], [products[15].id, 'tanqueray'],
    [products[16].id, 'cachaça'], [products[16].id, '51'],
    [products[17].id, 'coca'], [products[17].id, 'coca cola'], [products[17].id, 'coca 2l'],
    [products[18].id, 'guaraná'], [products[18].id, 'guarana'], [products[18].id, 'guaraná 2l'],
    [products[19].id, 'água'], [products[19].id, 'agua'],
    [products[20].id, 'suco'], [products[20].id, 'del valle'],
    [products[21].id, 'amendoim'],
    [products[22].id, 'batata'], [products[22].id, 'fritas'],
    [products[23].id, 'isca'], [products[23].id, 'frango'],
  ];

  for (const [productId, alias] of aliasMap) {
    db.insert('product_aliases', { id: uuid(), product_id: productId, alias });
  }

  console.log('[Seed] Initial data inserted');
}
