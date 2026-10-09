import crypto from 'node:crypto';
import {db,json,only} from './_lib/shared.js';
export default async function handler(req,res){
 if(!only(req,res,'POST'))return;
 try{
   const b=req.body||{};
   const items=Array.isArray(b.items)?b.items.map(i=>({variantId:String(i.variantId||''),size:String(i.size||''),quantity:Number(i.quantity)})):[];
   if(items.length<1||items.length>20||!items.every(x=>/^[a-zA-Z0-9_-]{1,80}$/.test(x.variantId)&&x.size.length<=16&&Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=10))
     return json(res,400,{error:'Panier invalide'});
   const name=String(b.customerName||'').trim(),phone=String(b.phone||'').trim(),
      address=String(b.address||'').trim(),city=String(b.city||'Lubumbashi').trim(),
      notes=String(b.notes||'').trim();
   if(name.length<2||name.length>100||phone.length<7||phone.length>32||address.length<8||address.length>350||notes.length>600)
      return json(res,400,{error:'Nom, téléphone ou adresse invalide'});
   const idempotency=String(b.idempotencyKey||'');
   if(!/^[A-Za-z0-9_-]{12,100}$/.test(idempotency))return json(res,400,{error:'Identifiant de commande invalide'});
   const token=crypto.randomBytes(32).toString('base64url');
   const hash=crypto.createHash('sha256').update(token).digest('hex');
   const sql=db();
   const rows=await sql`SELECT place_guest_order(${name},${phone},${address},${city},${notes},${JSON.stringify(items)}::jsonb,${idempotency},${hash}) AS result`;
   return json(res,201,{...rows[0].result,trackingToken:rows[0].result.existing?null:token,method:'Paiement à la livraison'});
 }catch(e){
   console.error('Place order:',e.name);
   return json(res,409,{error:'Commande non enregistrée. Vérifier les quantités et le stock disponibles.'});
 }
}
