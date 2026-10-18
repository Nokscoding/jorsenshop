import {db,json,only,requireRole} from '../_lib/shared.js';
function asDate(value){
 if(!value)return null;
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))throw Error('Date incorrecte');
 return date.toISOString();
}
function validTime(start,end){return !start||!end||new Date(end)>new Date(start);}
function amount(kind,value){
 const n=Number(value);
 if(!['percent','fixed'].includes(kind)||!Number.isSafeInteger(n)||n<1||n>(kind==='percent'?95:2_000_000_000))
  throw Error('Réduction incorrecte');
 return n;
}
function bannerUrl(value){
 try{
  const u=new URL(value);
  const cloud=process.env.CLOUDINARY_CLOUD_NAME;
  return Boolean(cloud&&u.protocol==='https:'&&u.hostname==='res.cloudinary.com'&&
   u.pathname.startsWith('/'+cloud+'/image/upload/')&&
   /\/jorsenshop\/(promotions|catalog)\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|avif)$/.test(u.pathname));
 }catch{return false}
}
export default async function handler(req,res){
 if(!requireRole(req,res,'admin'))return;
 const sql=db();
 if(req.method==='GET'){
  try{
   const [slides,discounts,coupons,products]=await Promise.all([
    sql`SELECT id,media_url,eyebrow,headline,description,cta,destination,position,active,starts_at,ends_at
      FROM promo_slides ORDER BY position,id LIMIT 100`,
    sql`SELECT product_id,kind,value,active,starts_at,ends_at FROM product_discounts ORDER BY updated_at DESC LIMIT 300`,
    sql`SELECT code,kind,value,min_subtotal_fc,max_uses,uses_count,active,starts_at,ends_at FROM promo_codes ORDER BY created_at DESC LIMIT 300`,
    sql`SELECT id,name,price_fc FROM products ORDER BY name LIMIT 300`
   ]);
   return json(res,200,{slides,discounts:discounts.map(d=>({...d,value:Number(d.value)})),
     coupons:coupons.map(c=>({...c,value:Number(c.value),min_subtotal_fc:Number(c.min_subtotal_fc)})),
     products:products.map(p=>({...p,price_fc:Number(p.price_fc)}))});
  }catch(e){console.error('Marketing read:',e.name);return json(res,503,{error:'Campagnes indisponibles : vérifier la migration 005'})}
 }
 if(!only(req,res,'POST'))return;
 try{
  const b=req.body||{},action=String(b.action||'');
  if(action==='slide'){
   const id=b.id&&/^[0-9a-f-]{36}$/i.test(b.id)?b.id:null;
   const url=String(b.mediaUrl||'').trim();
   if(!bannerUrl(url))return json(res,400,{error:'Importer une image Cloudinary Jorsenshop'});
   const headline=String(b.headline||'').trim();
   const destination=String(b.destination||'#catalogue').trim();
   const cta=String(b.cta||'Découvrir').trim();
   if(headline.length<2||headline.length>140||cta.length>50||
      !(/^\/(?!\/)[a-zA-Z0-9/_#?=%&.-]{0,180}$/.test(destination)||/^#[a-zA-Z0-9_-]{1,60}$/.test(destination)))
    return json(res,400,{error:'Titre ou destination invalide'});
   const starts=asDate(b.startsAt),ends=asDate(b.endsAt);
   if(!validTime(starts,ends))return json(res,400,{error:'Date de fin antérieure à la date de début'});
   const position=Number(b.position??0);
   if(!Number.isInteger(position)||Math.abs(position)>1000)return json(res,400,{error:'Ordre incorrect'});
   const rows=await sql`
    INSERT INTO promo_slides(id,media_url,eyebrow,headline,description,cta,destination,position,active,starts_at,ends_at,updated_at)
    VALUES(COALESCE(${id}::uuid,gen_random_uuid()),${url},${String(b.eyebrow||'').slice(0,70)},
     ${headline},${String(b.description||'').slice(0,300)},${cta},${destination},${position},${b.active===true},
     ${starts}::timestamptz,${ends}::timestamptz,now())
    ON CONFLICT(id) DO UPDATE SET media_url=excluded.media_url,eyebrow=excluded.eyebrow,
     headline=excluded.headline,description=excluded.description,cta=excluded.cta,destination=excluded.destination,
     position=excluded.position,active=excluded.active,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now()
    RETURNING id`;
   await sql`INSERT INTO audit_log(action,resource_type,resource_id) VALUES('marketing_slide','promo_slide',${String(rows[0].id)})`;
   return json(res,200,{ok:true,id:rows[0].id});
  }
  if(action==='discount'){
   const productId=String(b.productId||'');
   if(!/^js-[a-zA-Z0-9_-]{3,64}$/.test(productId))return json(res,400,{error:'Produit invalide'});
   const kind=String(b.kind||''),value=amount(kind,b.value);
   const starts=asDate(b.startsAt),ends=asDate(b.endsAt);
   if(!validTime(starts,ends))return json(res,400,{error:'Période invalide'});
   const rows=await sql`
    INSERT INTO product_discounts(product_id,kind,value,active,starts_at,ends_at,updated_at)
    VALUES(${productId},${kind},${value},${b.active===true},${starts}::timestamptz,${ends}::timestamptz,now())
    ON CONFLICT(product_id) DO UPDATE SET kind=excluded.kind,value=excluded.value,active=excluded.active,
      starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now() RETURNING product_id`;
   await sql`INSERT INTO audit_log(action,resource_type,resource_id) VALUES('marketing_discount','product',${rows[0].product_id})`;
   return json(res,200,{ok:true});
  }
  if(action==='coupon'){
   const code=String(b.code||'').trim().toUpperCase();
   if(!/^[A-Z0-9_-]{4,32}$/.test(code))return json(res,400,{error:'Code : 4 à 32 caractères, A-Z, chiffres, _ ou -'});
   const kind=String(b.kind||''),value=amount(kind,b.value);
   const min=Number(b.minSubtotalFc??0),max=b.maxUses===''||b.maxUses==null?null:Number(b.maxUses);
   if(!Number.isSafeInteger(min)||min<0||min>2_000_000_000||
       (max!==null&&(!Number.isSafeInteger(max)||max<1||max>1_000_000)))
    return json(res,400,{error:'Minimum ou limite d’utilisation invalide'});
   const starts=asDate(b.startsAt),ends=asDate(b.endsAt);
   if(!validTime(starts,ends))return json(res,400,{error:'Période invalide'});
   await sql`
    INSERT INTO promo_codes(code,kind,value,min_subtotal_fc,max_uses,active,starts_at,ends_at)
    VALUES(${code},${kind},${value},${min},${max},${b.active===true},${starts}::timestamptz,${ends}::timestamptz)
    ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,value=excluded.value,min_subtotal_fc=excluded.min_subtotal_fc,
      max_uses=excluded.max_uses,active=excluded.active,starts_at=excluded.starts_at,
      ends_at=excluded.ends_at,updated_at=now()`;
   await sql`INSERT INTO audit_log(action,resource_type,resource_id) VALUES('marketing_coupon','promo_code',${code})`;
   return json(res,200,{ok:true});
  }
  if(action==='remove'){
   const kind=String(b.kind||''),id=String(b.id||'');
   if(kind==='slide'&&/^[0-9a-f-]{36}$/i.test(id))await sql`DELETE FROM promo_slides WHERE id=${id}::uuid`;
   else if(kind==='discount'&&/^js-[a-zA-Z0-9_-]{3,64}$/.test(id))
     await sql`DELETE FROM product_discounts WHERE product_id=${id}`;
   else if(kind==='coupon'&&/^[A-Z0-9_-]{4,32}$/.test(id))
     await sql`UPDATE promo_codes SET active=false,updated_at=now() WHERE code=${id}`;
   else return json(res,400,{error:'Élément invalide'});
   await sql`INSERT INTO audit_log(action,resource_type,resource_id) VALUES('marketing_remove',${kind},${id})`;
   return json(res,200,{ok:true});
  }
  return json(res,400,{error:'Action inconnue'});
 }catch(e){
  console.error('Marketing write:',e.name);
  return json(res,400,{error:e.message==='Date incorrecte'||e.message==='Réduction incorrecte'?e.message:'Opération impossible : vérifier la migration et les données'});
 }
}
