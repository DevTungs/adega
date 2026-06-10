import { DatabaseWrapper } from '../../config/database';
import { v4 as uuid } from 'uuid';

export async function seed(db: DatabaseWrapper): Promise<void> {
  // Check if pizza product already exists
  const existing = db.get("SELECT 1 FROM products WHERE name = 'Pizza'");
  if (existing) {
    console.log('[Seed] Pizza example already exists, skipping');
    return;
  }

  // 1. Category
  const catId = uuid();
  db.insert('categories', {
    id: catId,
    name: 'Pizzas',
    slug: 'pizzas',
    description: 'Pizzas salgadas',
    display_order: 1,
    is_active: 1,
  });

  // 2. Product "Pizza"
  const productId = uuid();
  db.insert('products', {
    id: productId,
    category_id: catId,
    name: 'Pizza',
    slug: 'pizza',
    description: 'Pizza tradicional',
    price: 0,
    stock: 999,
    unit: 'un',
    is_active: 1,
  });

  // 3. Variants (sizes)
  const sizes = [
    { name: 'Brotinho', price: 29.90, sort: 1 },
    { name: 'Média', price: 39.90, sort: 2 },
    { name: 'Grande', price: 49.90, sort: 3 },
    { name: 'Gigante', price: 59.90, sort: 4 },
  ];
  for (const s of sizes) {
    db.insert('product_variants', {
      id: uuid(),
      product_id: productId,
      name: s.name,
      price: s.price,
      sort_order: s.sort,
      is_active: 1,
    });
  }

  // 4. Modifier "Sabores" (creates_splits = 1)
  const saborModId = uuid();
  db.insert('product_modifiers', {
    id: saborModId,
    product_id: productId,
    name: 'Sabores',
    type: 'required',
    min_select: 1,
    max_select: 2,
    sort_order: 1,
    is_active: 1,
    creates_splits: 1,
  });

  const sabores = [
    'Calabresa', 'Mussarela', 'Toscana', 'Portuguesa',
    'Frango com Catupiry', 'Marguerita', 'Napolitana', 'Atum',
    'Lombo', 'Bacon', '4 Queijos', 'Pepperoni',
  ];
  for (let i = 0; i < sabores.length; i++) {
    db.insert('modifier_options', {
      id: uuid(),
      modifier_id: saborModId,
      name: sabores[i],
      price_add: 0,
      sort_order: i + 1,
      is_active: 1,
    });
  }

  // 5. Modifier "Borda" (no splits)
  const bordaModId = uuid();
  db.insert('product_modifiers', {
    id: bordaModId,
    product_id: productId,
    name: 'Borda',
    type: 'single',
    min_select: 0,
    max_select: 1,
    sort_order: 2,
    is_active: 1,
    creates_splits: 0,
  });

  const bordas = [
    { name: 'Catupiry', price: 4.00 },
    { name: 'Cheddar', price: 4.00 },
    { name: 'Chocolate', price: 5.00 },
  ];
  for (let i = 0; i < bordas.length; i++) {
    db.insert('modifier_options', {
      id: uuid(),
      modifier_id: bordaModId,
      name: bordas[i].name,
      price_add: bordas[i].price,
      sort_order: i + 1,
      is_active: 1,
    });
  }

  // Product aliases
  db.insert('product_aliases', { id: uuid(), product_id: productId, alias: 'pizza' });
  db.insert('product_aliases', { id: uuid(), product_id: productId, alias: 'pizzas' });

  console.log('[Seed] Pizza example created (product, sizes, sabores, bordas)');
}
