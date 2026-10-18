import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({error:"Méthode non autorisée"});
  res.setHeader("Cache-Control","public, max-age=30");
  if (!process.env.DATABASE_URL) return res.status(503).json({error:"Base non configurée"});
  try {
    const sql=neon(process.env.DATABASE_URL);
    const rows=await sql`
      SELECT p.id,p.name,p.category,p.description,p.price_fc,p.tag,p.sizes,
        MAX(d.kind) AS discount_kind,MAX(d.value) AS discount_value,
        COALESCE(json_agg(json_build_object('id',v.id,'color',v.color,'images',v.images)
          ORDER BY v.id) FILTER (WHERE v.id IS NOT NULL),'[]'::json) AS variants
      FROM products p LEFT JOIN product_discounts d ON d.product_id=p.id AND d.active=true
        AND (d.starts_at IS NULL OR d.starts_at<=now()) AND (d.ends_at IS NULL OR d.ends_at>now())
      LEFT JOIN product_variants v ON v.product_id=p.id
      WHERE p.is_published=true
      GROUP BY p.id ORDER BY p.id LIMIT 200
    `;
    return res.status(200).json({products:rows.map(r=>({
      id:r.id,name:r.name,category:r.category,description:r.description,
      price:r.discount_kind==='percent'?Math.max(0,Number(r.price_fc)-Math.round(Number(r.price_fc)*Number(r.discount_value)/100)):
         r.discount_kind==='fixed'?Math.max(0,Number(r.price_fc)-Number(r.discount_value)):Number(r.price_fc),
      originalPrice:Number(r.price_fc),discount:r.discount_kind?{kind:r.discount_kind,value:Number(r.discount_value)}:null,tag:r.tag,sizes:r.sizes,variants:r.variants
    }))});
  }catch(e){
    console.error("[Jorsenshop products]",e?.name||"DatabaseError");
    return res.status(503).json({error:"Catalogue indisponible"});
  }
}
