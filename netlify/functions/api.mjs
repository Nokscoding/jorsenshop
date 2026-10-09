// Jorsenshop — API publique en lecture seule (Netlify Functions).
// Les opérations privées seront ajoutées avec une authentification serveur.
import { neon } from '@neondatabase/serverless';

function json(body, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache,
      'x-content-type-options': 'nosniff'
    }
  });
}

function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: Number(row.price_fc),
    tag: row.tag,
    sizes: row.sizes,
    variants: row.variants
  };
}

export default async function handler(request) {
  if (request.method !== 'GET') return json({ error: 'Méthode non autorisée' }, 405);
  const pathname = new URL(request.url).pathname;
  const prefix = pathname.lastIndexOf('/api');
  const route = prefix === -1 ? '' : pathname.slice(prefix + 4).replace(/\/+$/, '') || '/';
  if (route !== '/health' && route !== '/products' && !/^\/products\/[a-zA-Z0-9_-]{1,64}$/.test(route)) {
    return json({ error: 'Route inconnue' }, 404);
  }
  if (!process.env.DATABASE_URL) {
    return json({ ok: false, error: 'Neon non configuré côté serveur' }, 503);
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    if (route === '/health') {
      await sql.query('SELECT 1 AS alive');
      return json({ ok: true, database: 'connected' });
    }

    const productId = route.startsWith('/products/') ? route.slice('/products/'.length) : null;
    const query = [
      'SELECT p.id, p.name, p.category, p.description, p.price_fc, p.tag, p.sizes,',
      "COALESCE(json_agg(json_build_object('id', v.id, 'color', v.color, 'images', v.images) ORDER BY v.id)",
      "FILTER (WHERE v.id IS NOT NULL), '[]'::json) AS variants",
      'FROM products p LEFT JOIN product_variants v ON v.product_id = p.id',
      'WHERE p.is_published = true AND p.prices_confirmed = true',
      'AND ($1::text IS NULL OR p.id = $1)',
      'GROUP BY p.id ORDER BY p.id LIMIT 200'
    ].join(' ');
    const rows = await sql.query(query, [productId]);
    if (productId && rows.length === 0) return json({ error: 'Produit non disponible' }, 404);
    if (productId) return json({ product: formatProduct(rows[0]) }, 200, 'public, max-age=30');
    return json({ products: rows.map(formatProduct) }, 200, 'public, max-age=30');
  } catch (error) {
    console.error('[Jorsenshop API] Failed:', error?.name || 'UnknownError');
    return json({ ok: false, error: 'Service temporairement indisponible' }, 503);
  }
}
