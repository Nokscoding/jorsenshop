import {dispatchPendingPush} from './_lib/push-dispatch.js';
import crypto from 'node:crypto';
import {db,json,only,rateLimit} from '../_lib/shared.js';
import {currentUser,requireUser,validWriteOrigin} from './_lib/identity.js';
import {shippingQuote,normalizeCity} from '../../../v2/shipping-policy.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Méthode interdite'});
 const user=await requireUser(req,res);if(!user)return;
 const sql=db();
 if(req.method==='GET'){
  try{
   const orders=await sql`SELECT order_number,status,payment_status,total_fc,delivery_fee_fc,
     delivery_city,v2_delivery_mode,v2_shipping_agency,v2_tracking_number,created_at
     FROM orders WHERE v2_client_auth_id=${user.id} ORDER BY created_at DESC LIMIT 100`;
   return json(res,200,{orders:orders.map(o=>({...o,totalFc:Number(o.total_fc),feeFc:Number(o.delivery_fee_fc)}))});
  }catch{return json(res,503,{error:'Historique indisponible'})}
 }
 if(!only(req,res,'POST')||!validWriteOrigin(req,res))return;
 try{if(!await rateLimit(req,'v2_checkout',10,60))
   return json(res,429,{error:'Trop de commandes, réessayez plus tard'});
 }catch{return json(res,503,{error:'Commande temporairement indisponible'})}
 const b=req.body||{};
 const items=Array.isArray(b.items)?b.items.map(i=>({
  variantId:String(i.variantId||''),size:String(i.size||''),quantity:Number(i.quantity)
 })):[];
 if(!items.length||items.length>20||!items.every(i=>/^[a-zA-Z0-9_-]{2,80}$/.test(i.variantId)
   &&i.size.length<=16&&Number.isInteger(i.quantity)&&i.quantity>=1&&i.quantity<=10))
  return json(res,400,{error:'Panier invalide'});
 const name=String(b.customerName||'').trim(),phone=String(b.phone||'').trim(),
  address=String(b.address||'').trim(),city=normalizeCity(b.city),
  notes=String(b.notes||'').trim(),idempotency=String(b.idempotencyKey||'');
 if(name.length<2||name.length>100||phone.length<7||phone.length>32||address.length<8
   ||address.length>350||notes.length>600||!city||!(/^[a-zA-Z0-9_-]{12,100}$/).test(idempotency))
  return json(res,400,{error:'Coordonnées de livraison incorrectes'});
 let quote;
 try{quote=shippingQuote(city,b.mode)}catch{return json(res,400,{error:'Mode ou ville non desservie'})}
 if(quote.paymentRequiredBeforePurchase&&!['airtel_money','orange_money'].includes(b.paymentProvider))
  return json(res,400,{error:'Choisir Airtel Money ou Orange Money pour l’expédition'});
 const trackingToken=crypto.randomBytes(32).toString('base64url');
 const tokenHash=crypto.createHash('sha256').update(trackingToken).digest('hex');
 try{
  const rows=await sql`SELECT place_v2_order(${user.id},${name},${phone},${address},${city},
    ${notes},${JSON.stringify(items)}::jsonb,${idempotency},${tokenHash},${quote.mode},${quote.paymentRequiredBeforePurchase?b.paymentProvider:null}) AS result`;
  const result=rows[0].result;
  await dispatchPendingPush();
  return json(res,201,{...result,trackingToken:result.existing?null:trackingToken,
    instruction:quote.paymentRequiredBeforePurchase?
    'La préparation et l’expédition commenceront après vérification du paiement Mobile Money par le gérant.':
    'Paiement à la réception. Le gérant confirmera la commande.'});
 }catch(e){console.error('v2 checkout',e?.name);return json(res,409,{error:'Commande refusée : prix ou stock indisponible'})}
}
