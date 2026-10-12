import crypto from 'node:crypto';
import {db,json,only} from './_lib/shared.js';
export default async function handler(req,res){
 if(!only(req,res,'POST'))return;
 const b=req.body||{};
 if(typeof b.orderNumber!=='string'||typeof b.trackingToken!=='string'||b.orderNumber.length>60||b.trackingToken.length>100)
    return json(res,400,{error:'Référence incorrecte'});
 const hash=crypto.createHash('sha256').update(b.trackingToken).digest('hex');
 try{
  const rows=await db()`SELECT order_number,status,payment_status,total_fc,created_at FROM orders WHERE order_number=${b.orderNumber} AND tracking_token_hash=${hash}`;
  if(!rows.length)return json(res,404,{error:'Commande introuvable'});
  return json(res,200,{order:{number:rows[0].order_number,status:rows[0].status,payment:rows[0].payment_status,total:Number(rows[0].total_fc),createdAt:rows[0].created_at}});
 }catch(e){console.error(e.name);return json(res,503,{error:'Service indisponible'})}
}
