import { neon } from "@neondatabase/serverless";

export default async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Méthode non autorisée"});
  const id=typeof req.query?.id==="string"?req.query.id:"";
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id))return res.status(400).json({error:"Identifiant incorrect"});
  if(!process.env.DATABASE_URL)return res.status(503).json({error:"Base non configurée"});
  try{
    const sql=neon(process.env.DATABASE_URL);
    const rows=await sql`
      SELECT p.id,p.name,p.category,p.description,p.price_fc,p.tag,p.sizes,
        MAX(d.kind) AS discount_kind,MAX(d.value) AS discount_value,
        COALESCE(json_agg(json_build_object('id',v.id,'color',v.color,'images',v.images)
          ORDER BY v.id) FILTER (WHERE v.id IS NOT NULL),'[]'::json) AS variants
      FROM products p LEFT JOIN product_discounts d ON d.product_id=p.id AND d.active=true
        AND (d.starts_at IS NULL OR d.starts_at<=now()) AND (d.ends_at IS NULL OR d.ends_at>now())
      LEFT JOIN product_variants v ON v.product_id=p.id
      WHERE p.is_published=true AND p.id=${id}
      GROUP BY p.id LIMIT 1
    `;
    if(!rows.length)return res.status(404).json({error:"Produit indisponible"});
    const p=rows[0];
    res.setHeader("Cache-Control","public, max-age=30");
    return res.status(200).json({product:{
      id:p.id,name:p.name,category:p.category,description:p.description,
      price:p.discount_kind==='percent'?Math.max(0,Number(p.price_fc)-Math.round(Number(p.price_fc)*Number(p.discount_value)/100)):
        p.discount_kind==='fixed'?Math.max(0,Number(p.price_fc)-Number(p.discount_value)):Number(p.price_fc),
      originalPrice:Number(p.price_fc),discount:p.discount_kind?{kind:p.discount_kind,value:Number(p.discount_value)}:null,tag:p.tag,sizes:p.sizes,variants:p.variants
    }});
  }catch(e){
    console.error("[Jorsenshop product detail]",e?.name||"DatabaseError");
    return res.status(503).json({error:"Produit momentanément indisponible"});
  }
}
