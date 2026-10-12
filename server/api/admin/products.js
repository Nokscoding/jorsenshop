import crypto from 'node:crypto';
import {db,json,only,requireRole,cloudUrl} from '../_lib/shared.js';
export default async function handler(req,res){
 if(!requireRole(req,res,'admin'))return;
 const sql=db();
 if(req.method==='GET'){
  try{
   const rows=await sql`
    SELECT p.id,p.name,p.category,p.description,p.price_fc,p.tag,p.sizes,p.is_published,p.prices_confirmed,
      COALESCE((SELECT json_agg(json_build_object(
        'id',v.id,'color',v.color,'images',v.images,'stock',
          COALESCE((SELECT json_object_agg(s.size,s.quantity) FROM variant_stock s WHERE s.variant_id=v.id),'{}'::json)
       ) ORDER BY v.id) FROM product_variants v WHERE v.product_id=p.id),'[]'::json) AS variants
    FROM products p ORDER BY p.created_at DESC LIMIT 300`;
   return json(res,200,{products:rows.map(p=>({
      id:p.id,name:p.name,category:p.category,description:p.description,
      priceFc:Number(p.price_fc),tag:p.tag,sizes:p.sizes,
      isPublished:p.is_published,pricesConfirmed:p.prices_confirmed,variants:p.variants
   }))});
  }catch(e){console.error(e.name);return json(res,503,{error:'Catalogue indisponible'})}
 }
 if(!only(req,res,'POST'))return;
 try{
   const b=req.body||{};
   const id=b.id&&/^js-[a-zA-Z0-9_-]{3,64}$/.test(b.id)?b.id:'js-'+crypto.randomUUID().replaceAll('-','').slice(0,16);
   const variants=b.variants;
   if(!Array.isArray(variants)||!variants.length||variants.length>40)return json(res,400,{error:'Ajouter au moins une couleur'});
   const safe=[];
   for(const v of variants){
     const images=Array.isArray(v.images)?v.images:[];
     if(images.length>8||!images.every(cloudUrl))return json(res,400,{error:'Importer les photos via Cloudinary uniquement'});
     const stock={};
     for(const [size,quantity] of Object.entries(v.stock||{})){
       if(!/^[a-zA-Z0-9 -]{1,16}$/.test(size)||!Number.isSafeInteger(Number(quantity))||Number(quantity)<0||Number(quantity)>100000)
         return json(res,400,{error:'Stock invalide'});
       stock[size]=Number(quantity);
     }
     const variantId=v.id&&v.id.startsWith(id+'-v')?v.id:id+'-v'+crypto.randomUUID().replaceAll('-','').slice(0,10);
     safe.push({id:variantId,color:String(v.color||'').trim().slice(0,80),images,stock});
   }
   const priceFc=Number(b.priceFc);
   if(!Number.isSafeInteger(priceFc)||priceFc<0||priceFc>2_000_000_000)return json(res,400,{error:'Prix en FC incorrect'});
   const sizes=Array.isArray(b.sizes)?b.sizes.filter(x=>/^[a-zA-Z0-9 -]{1,16}$/.test(x)).slice(0,30):[];
   const payload={id,name:String(b.name||'').trim().slice(0,150),category:String(b.category||'').trim().slice(0,80),
     description:String(b.description||'').trim().slice(0,3000),priceFc,tag:String(b.tag||'').slice(0,100),
     sizes,pricesConfirmed:b.pricesConfirmed===true,isPublished:b.isPublished===true,variants:safe};
   const rows=await sql`SELECT staff_save_product(${JSON.stringify(payload)}::jsonb) AS id`;
   await sql`INSERT INTO audit_log(action,resource_type,resource_id,metadata) VALUES('save_product','product',${rows[0].id},'{}'::jsonb)`;
   return json(res,200,{ok:true,id:rows[0].id});
 }catch(e){
   console.error('Product mutation:',e.name);
   return json(res,400,{error:'Produit non enregistré : vérifier les images, le stock et les champs.'});
 }
}
