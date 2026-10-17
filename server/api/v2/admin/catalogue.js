import crypto from 'node:crypto';
import {db,json,only,cloudUrl} from '../../_lib/shared.js';
import {requireStaff,validWriteOrigin} from '../_lib/identity.js';
const slugify=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
 .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Méthode interdite'});
 const staff=await requireStaff(req,res);if(!staff)return;
 const sql=db();
 if(req.method==='GET'){
  const [categories,products]=await Promise.all([
   sql`SELECT id,name,slug,active,position FROM v2_categories ORDER BY position,name`,
   sql`SELECT p.id,p.name,p.category,p.description,p.price_fc,p.purchase_cost_fc,p.sizes,p.is_published,p.prices_confirmed,
      COALESCE((SELECT json_agg(json_build_object('id',v.id,'color',v.color,'images',v.images,
        'stock',COALESCE((SELECT json_object_agg(s.size,s.quantity)
         FROM variant_stock s WHERE s.variant_id=v.id),'{}'::json),
        'stockProvisional',COALESCE((SELECT json_object_agg(s.size,s.is_provisional)
         FROM variant_stock s WHERE s.variant_id=v.id),'{}'::json))
       ORDER BY v.id) FROM product_variants v WHERE v.product_id=p.id),'[]'::json) AS variants
    FROM products p ORDER BY p.id DESC LIMIT 400`
  ]);
  return json(res,200,{categories,products:products.map(p=>({...p,priceFc:Number(p.price_fc),purchaseCostFc:p.purchase_cost_fc===null?null:Number(p.purchase_cost_fc)}))});
 }
 if(!only(req,res,'POST')||!validWriteOrigin(req,res))return;
 const b=req.body||{};
 if(b.action==='create-category'){
  const name=String(b.name||'').trim(),slug=slugify(name);
  if(name.length<2||name.length>80||slug.length<2)return json(res,400,{error:'Nom de catégorie invalide'});
  try{
   const rows=await sql`INSERT INTO v2_categories(name,slug) VALUES(${name},${slug})
     RETURNING id,name,slug`;
   return json(res,201,{category:rows[0]});
  }catch{return json(res,409,{error:'Catégorie déjà existante'})}
 }
 if(b.action==='rename-category'){
  const name=String(b.name||'').trim(),slug=slugify(name),oldName=String(b.oldName||'');
  if(name.length<2||name.length>80||slug.length<2||oldName.length>80)
   return json(res,400,{error:'Nom invalide'});
  try{
   const rows=await sql`SELECT v2_rename_category(${oldName},${name},${slug}) AS updated`;
   return json(res,200,{ok:true,updated:rows[0].updated});
  }catch{return json(res,409,{error:'Renommage impossible'})}
 }
 if(b.action==='update-metadata'){
  const id=String(b.id||''),name=String(b.name||'').trim(),category=String(b.category||'').trim(),
    priceFc=Number(b.priceFc),description=String(b.description||'').trim(),
    hasCost=Object.prototype.hasOwnProperty.call(b,'purchaseCostFc'),
    purchaseCostFc=b.purchaseCostFc===''||b.purchaseCostFc===null?null:Number(b.purchaseCostFc);
  if(!/^js-[a-zA-Z0-9_-]{3,64}$/.test(id)||name.length<2||name.length>150||
     !Number.isSafeInteger(priceFc)||priceFc<0||description.length>3000||
     (hasCost&&purchaseCostFc!==null&&(!Number.isSafeInteger(purchaseCostFc)||purchaseCostFc<0)))
    return json(res,400,{error:'Fiche produit invalide'});
  const cats=await sql`SELECT 1 FROM v2_categories WHERE name=${category} AND active=true`;
  if(!cats.length)return json(res,400,{error:'Catégorie inexistante'});
  // Editing a price/name must never depend on stock or a separate price approval.
  // Publishing is a separate manager action; keep the existing publication state.
  const rows=await sql`UPDATE products SET name=${name},category=${category},description=${description},
    price_fc=${priceFc},purchase_cost_fc=CASE WHEN ${hasCost} THEN ${purchaseCostFc} ELSE purchase_cost_fc END,
    updated_at=now() WHERE id=${id} RETURNING id`;
  return json(res,rows.length?200:404,{ok:!!rows.length,id});
 }
 if(b.action==='set-stock'){
  const id=String(b.id||''),variantId=String(b.variantId||''),size=String(b.size||'').trim(),
    quantity=Number(b.quantity);
  if(!/^js-[a-zA-Z0-9_-]{3,64}$/.test(id) ||
     !/^js-[a-zA-Z0-9_-]{3,64}-v[a-zA-Z0-9_-]+$/.test(variantId) ||
     !/^[a-zA-Z0-9 -]{1,16}$/.test(size) || !Number.isSafeInteger(quantity) ||
     quantity<0 || quantity>100000)
    return json(res,400,{error:'Stock incorrect'});
  const variants=await sql`SELECT id FROM product_variants WHERE id=${variantId} AND product_id=${id}`;
  if(!variants.length)return json(res,404,{error:'Variante inexistante'});
  const rows=await sql`INSERT INTO variant_stock(variant_id,size,quantity)
    VALUES(${variantId},${size},${quantity})
    ON CONFLICT(variant_id,size) DO UPDATE
    SET quantity=EXCLUDED.quantity,is_provisional=false
    WHERE variant_stock.reserved<=EXCLUDED.quantity RETURNING quantity`;
  if(!rows.length)return json(res,409,{error:'Stock inférieur aux quantités réservées'});
  return json(res,200,{ok:true,quantity:Number(rows[0].quantity)});
 }
 if(b.action==='set-publication'){
  const id=String(b.id||''),publish=b.publish===true;
  if(!/^js-[a-zA-Z0-9_-]{3,64}$/.test(id))return json(res,400,{error:'Article incorrect'});
  if(publish){
   const available=await sql`SELECT 1 FROM product_variants v JOIN variant_stock st ON st.variant_id=v.id
      WHERE v.product_id=${id} AND st.quantity>st.reserved LIMIT 1`;
   if(!available.length)return json(res,409,{error:'Un stock disponible est nécessaire pour ouvrir les commandes'});
  }
  const result=await sql`UPDATE products SET is_published=${publish},updated_at=now()
   WHERE id=${id} RETURNING id`;
  return json(res,result.length?200:404,{ok:!!result.length,id,published:publish});
 }
 if(b.action==='save-product'){
  const name=String(b.name||'').trim(),category=String(b.category||'').trim();
  const priceFc=Number(b.priceFc),variants=b.variants,
   purchaseCostFc=b.purchaseCostFc===''||b.purchaseCostFc===null||b.purchaseCostFc===undefined?
    null:Number(b.purchaseCostFc);
  if(name.length<2||name.length>150||!Number.isSafeInteger(priceFc)||priceFc<0||
     !Array.isArray(variants)||!variants.length||variants.length>35||
     (purchaseCostFc!==null&&(!Number.isSafeInteger(purchaseCostFc)||purchaseCostFc<0)))
   return json(res,400,{error:'Données produit incomplètes'});
  const validCat=await sql`SELECT 1 FROM v2_categories WHERE name=${category} AND active=true`;
  if(!validCat.length)return json(res,400,{error:'Sélectionnez une catégorie existante'});
  const id=b.id&&/^js-[a-zA-Z0-9_-]{3,64}$/.test(b.id)?b.id:
    'js-'+crypto.randomUUID().replaceAll('-','').slice(0,16);
  const safe=[];
  for(const v of variants){
   const images=Array.isArray(v.images)?v.images:[];
   if(!images.length||images.length>8||!images.every(cloudUrl))
    return json(res,400,{error:'Photos Cloudinary manquantes ou invalides'});
   const stock={};
   for(const [size,qty] of Object.entries(v.stock||{})){
    if(!/^[a-zA-Z0-9 -]{1,16}$/.test(size)||!Number.isInteger(Number(qty))||
       Number(qty)<0||Number(qty)>100000)return json(res,400,{error:'Stock incorrect'});
    stock[size]=Number(qty);
   }
   safe.push({id:v.id?.startsWith(id+'-v')?v.id:id+'-v'+crypto.randomUUID().slice(0,8),
     color:String(v.color||'').trim().slice(0,80),images,stock});
  }
  const payload={
   id,name,category,description:String(b.description||'').trim().slice(0,3000),
   priceFc,tag:String(b.tag||'').slice(0,100),
   sizes:(Array.isArray(b.sizes)?b.sizes:[]).filter(s=>/^[a-zA-Z0-9 -]{1,16}$/.test(s)).slice(0,30),
   pricesConfirmed:false,isPublished:b.isPublished===true,variants:safe
  };
  try{
   const rows=await sql`SELECT staff_save_product(${JSON.stringify(payload)}::jsonb) AS id`;
   if(purchaseCostFc!==null)await sql`UPDATE products SET purchase_cost_fc=${purchaseCostFc} WHERE id=${rows[0].id}`;
   return json(res,200,{ok:true,id:rows[0].id});
  }catch(e){console.error('v2 save product',e?.name);return json(res,409,{error:'Enregistrement refusé : vérifiez les stocks et les variantes'})}
 }
 return json(res,400,{error:'Action inconnue'});
}
