import crypto from 'node:crypto';
import {db,json,only,rateLimit} from '../_lib/shared.js';
import {currentUser,staffRole,validWriteOrigin} from './_lib/identity.js';

// Guest messages require the confidential token issued with the order.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Méthode interdite'});
 const user=await currentUser(req),body=req.body||{};
 const action=req.method==='GET'?'list':String(body.action||'send');
 if(!['list','send'].includes(action))return json(res,400,{error:'Action inconnue'});
 if(req.method==='POST'&&(!only(req,res,'POST')||!validWriteOrigin(req,res)))return;
 const orderNumber=String(req.method==='GET'?req.query?.orderNumber:body.orderNumber||'');
 if(!/^JS-[0-9]{8}-[0-9]{6}$/.test(orderNumber))
  return json(res,400,{error:'Référence de commande invalide'});
 const token=String(body.trackingToken||'');
 const tokenValid=/^[A-Za-z0-9_-]{32,100}$/.test(token);
 const tokenHash=tokenValid?crypto.createHash('sha256').update(token).digest('hex'):null;
 const sql=db();
 const orders=await sql`SELECT id,v2_client_auth_id,tracking_token_hash FROM orders
   WHERE order_number=${orderNumber} LIMIT 1`;
 if(!orders.length)return json(res,404,{error:'Commande introuvable'});
 const order=orders[0],staff=user?await staffRole(user,['admin','gerant']):null;
 const owned=!!user && order.v2_client_auth_id===user.id;
 const receipt=tokenHash!==null && tokenHash===order.tracking_token_hash;
 if(!staff&&!owned&&!receipt)
  return json(res,403,{error:'Compte ou reçu de commande nécessaire'});
 const guestActor=receipt?'guest:'+tokenHash:null;
 if(action==='list'){
  const rows=await sql`SELECT id,auth_user_id,sender_type,message,created_at
    FROM v2_order_messages WHERE order_id=${order.id} ORDER BY created_at ASC LIMIT 300`;
  return json(res,200,{messages:rows.map(m=>({
   id:m.id,sender_type:m.sender_type,message:m.message,created_at:m.created_at,
   isMine:(!!user&&m.auth_user_id===user.id)||(!!guestActor&&m.auth_user_id===guestActor)
  }))});
 }
 if(req.method!=='POST')return json(res,405,{error:'Méthode interdite'});
 const msg=String(body.message||'').trim();
 if(!msg||msg.length>2000)return json(res,400,{error:'Message invalide'});
 try{
  if(!await rateLimit(req,'v2_message',40,5))
   return json(res,429,{error:'Trop de messages, veuillez patienter'});
 }catch{return json(res,503,{error:'Messagerie momentanément indisponible'})}
 const sender=staff?'staff':'client';
 const actor=staff||owned?user.id:guestActor;
 const rows=await sql`INSERT INTO v2_order_messages(order_id,auth_user_id,sender_type,message)
  VALUES(${order.id},${actor},${sender},${msg}) RETURNING id`;
 if(sender==='client'){
  await sql`INSERT INTO v2_notifications(user_auth_id,order_id,kind,title)
   SELECT auth_user_id,${order.id},'new_message','Nouveau message pour '||${orderNumber}
   FROM v2_user_roles WHERE enabled AND role IN('admin','gerant')`;
 }else if(order.v2_client_auth_id){
  await sql`INSERT INTO v2_notifications(user_auth_id,order_id,kind,title)
   VALUES(${order.v2_client_auth_id},${order.id},'new_message','Nouvelle réponse de JorsenShop')`;
 }
 return json(res,201,{ok:true,id:rows[0].id});
}
