import {db,json,only,rateLimit} from './_lib/shared.js';
export default async function handler(req,res){
 if(!only(req,res,'POST'))return;
 try{if(!await rateLimit(req,'promo_quote',45,15))return json(res,429,{error:'Trop de demandes. Réessaie plus tard.'})}
 catch{return json(res,503,{error:'Réessayer plus tard'})}
 try{
  const items=req.body?.items,code=String(req.body?.promoCode||'').trim().toUpperCase();
  if(!Array.isArray(items)||items.length<1||items.length>20||
    !items.every(x=>/^[a-zA-Z0-9_-]{1,80}$/.test(String(x.variantId||''))&&Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=10)||
    (code&&!/^[A-Z0-9_-]{4,32}$/.test(code)))return json(res,400,{error:'Panier ou code invalide'});
  const sql=db();
  let regularSubtotal=0,discountedSubtotal=0;
  for(const item of items){
   const rows=await sql`SELECT p.price_fc,d.kind,d.value FROM product_variants v
     JOIN products p ON p.id=v.product_id
     LEFT JOIN product_discounts d ON d.product_id=p.id AND d.active=true
      AND (d.starts_at IS NULL OR d.starts_at<=now()) AND (d.ends_at IS NULL OR d.ends_at>now())
     WHERE v.id=${item.variantId} AND p.is_published=true`;
   if(!rows.length)return json(res,400,{error:'Produit indisponible'});
   const p=rows[0],price=Number(p.price_fc);
   const effective=p.kind==='percent'?Math.max(0,price-Math.round(price*Number(p.value)/100)):
     p.kind==='fixed'?Math.max(0,price-Number(p.value)):price;
   regularSubtotal+=price*item.quantity;
   discountedSubtotal+=effective*item.quantity;
  }
  let couponDiscount=0;
  if(code){
   const rows=await sql`SELECT kind,value,min_subtotal_fc,max_uses,uses_count FROM promo_codes WHERE code=${code}
       AND active=true AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now())`;
   const promo=rows[0];
   if(!promo||(promo.max_uses!==null&&promo.uses_count>=promo.max_uses))
     return json(res,400,{error:'Code promo invalide ou expiré'});
   if(discountedSubtotal<Number(promo.min_subtotal_fc))
     return json(res,400,{error:'Minimum de commande non atteint pour ce code'});
   couponDiscount=promo.kind==='percent'?Math.round(discountedSubtotal*Number(promo.value)/100):
      Math.min(discountedSubtotal,Number(promo.value));
  }
  return json(res,200,{regularSubtotal,discountedSubtotal,couponDiscount,
    discount:regularSubtotal-discountedSubtotal+couponDiscount,
    total:discountedSubtotal-couponDiscount,promoCode:code||null});
 }catch(e){console.error('Marketing quote:',e.name);return json(res,503,{error:'Calcul des promotions indisponible'})}
}
