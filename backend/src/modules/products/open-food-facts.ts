interface OFFProduct {
  found: boolean;
  product_name?: string;
  brands?: string;
  quantity?: string;
  image_url?: string;
  categories?: string;
}

export async function lookupBarcode(barcode: string): Promise<OFFProduct> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      return { found: false };
    }

    const data = await response.json() as any;

    if (data.status !== 1 || !data.product) {
      return { found: false };
    }

    const p = data.product;
    return {
      found: true,
      product_name: p.product_name || p.product_name_pt || p.generic_name || undefined,
      brands: p.brands || undefined,
      quantity: p.quantity || undefined,
      image_url: p.image_front_url || p.image_url || undefined,
      categories: p.categories || undefined,
    };
  } catch {
    return { found: false };
  }
}
