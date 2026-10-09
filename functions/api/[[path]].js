// API lecture seule Jorsenshop pour Cloudflare Pages Functions.
// Attention : commandes, comptes, livraison et revenus restent hors ligne
// tant que l'authentification/autorisation serveur n'est pas installée.
import { neon } from "@neondatabase/serverless";

function respond(body, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache,
      "x-content-type-options": "nosniff",
    },
  });
}

function publicProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: Number(row.price_fc), // Les montants FC sont entiers
    tag: row.tag,
    sizes: row.sizes,
    variants: row.variants,
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") return respond({ error: "Méthode non autorisée" }, 405);
  const route = new URL(request.url).pathname.replace(/\/+$/, "");
  const isHealth = route === "/api/health";
  const isList = route === "/api/products";
  const match = route.match(/^\/api\/products\/([A-Za-z0-9_-]{1,64})$/);
  if (!isHealth && !isList && !match) return respond({ error: "Route inconnue" }, 404);
  if (!env.DATABASE_URL) return respond({ ok: false, error: "Neon non configuré" }, 503);

  try {
    const sql = neon(env.DATABASE_URL);
    if (isHealth) {
      await sql`SELECT 1 AS alive`;
      return respond({ ok: true, database: "connected" });
    }

    const id = match ? match[1] : null;
    const rows = await sql`
      SELECT p.id, p.name, p.category, p.description, p.price_fc, p.tag, p.sizes,
        COALESCE(
          json_agg(
            json_build_object('id',v.id,'color',v.color,'images',v.images)
            ORDER BY v.id
          ) FILTER (WHERE v.id IS NOT NULL),
          '[]'::json
        ) AS variants
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      WHERE p.is_published = true
        AND p.prices_confirmed = true
        AND (${id}::text IS NULL OR p.id = ${id})
      GROUP BY p.id
      ORDER BY p.id
      LIMIT 200
    `;
    if (match) {
      if (!rows.length) return respond({ error: "Produit indisponible" }, 404);
      return respond({ product: publicProduct(rows[0]) }, 200, "public, max-age=30");
    }
    return respond({ products: rows.map(publicProduct) }, 200, "public, max-age=30");
  } catch (e) {
    // Ne jamais exposer les messages PostgreSQL dans les réponses publiques.
    console.error("Jorsenshop Neon query error:", e?.name || "UnknownError");
    return respond({ ok: false, error: "Service indisponible" }, 503);
  }
}
