import {db,json,only} from './_lib/shared.js';
export default async function handler(req,res){
 if(!only(req,res,'GET'))return;
 try{
  const sql=db();
  const [slides,discounts]=await Promise.all([
   sql`SELECT media_url AS "mediaUrl",eyebrow,headline,description,cta,destination,position
      FROM promo_slides WHERE active=true AND (starts_at IS NULL OR starts_at<=now())
        AND (ends_at IS NULL OR ends_at>now()) ORDER BY position,id LIMIT 12`,
   sql`SELECT d.product_id AS "productId",d.kind,d.value,p.price_fc AS "basePrice"
      FROM product_discounts d JOIN products p ON p.id=d.product_id
      WHERE d.active=true AND p.is_published=true AND p.prices_confirmed=true
       AND (d.starts_at IS NULL OR d.starts_at<=now()) AND (d.ends_at IS NULL OR d.ends_at>now())`
  ]);
  return json(res,200,{slides,discounts:discounts.map(d=>({...d,value:Number(d.value),basePrice:Number(d.basePrice)}))});
 }catch(e){console.error('Marketing public:',e.name);return json(res,503,{error:'Campagnes indisponibles'})}
}
