import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({error:"Méthode non autorisée"});
  res.setHeader("Cache-Control","public, max-age=30");
  if (!process.env.DATABASE_URL) return res.status(503).json({error:"Base non configurée"});
  try {
    const sql=neon(process.env.DATABASE_URL);
    const rows=await sql`
      SELECT p.id,p.name,p.category,p.description,p.price_fc,p.tag,p.sizes,
        COALESCE(json_agg(json_build_object('id',v.id,'color',v.color,'images',v.images)
          ORDER BY v.id) FILTER (WHERE v.id IS NOT NULL),'[]'::json) AS variants
      FROM products p LEFT JOIN product_variants v ON v.product_id=p.id
      WHERE p.is_published=true AND p.prices_confirmed=true
      GROUP BY p.id ORDER BY p.id LIMIT 200
    `;
    return res.status(200).json({products:rows.map(r=>({
      id:r.id,name:r.name,category:r.category,description:r.description,
      price:Number(r.price_fc),tag:r.tag,sizes:r.sizes,variants:r.variants
    }))});
  }catch(e){
    console.error("[Jorsenshop products]",e?.name||"DatabaseError");
    return res.status(503).json({error:"Catalogue indisponible"});
  }
}
