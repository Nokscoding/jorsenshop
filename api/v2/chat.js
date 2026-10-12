import {db,json,only,rateLimit} from '../_lib/shared.js';
import {requireUser,staffRole,validWriteOrigin} from './_lib/identity.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Méthode interdite'});
 const user=await requireUser(req,res);if(!user)return;
 const orderNumber=String(req.method==='GET'?req.query.orderNumber:req.body?.orderNumber||'');
 if(!/^JS-[0-9]{8}-[0-9]{6}$/.test(orderNumber))return json(res,400,{error:'Référence invalide'});
 const sql=db();
 const rows=await sql`SELECT id,v2_client_auth_id,customer_name FROM orders
   WHERE order_number=${orderNumber} LIMIT 1`;
 if(!rows.length)return json(res,404,{error:'Commande introuvable'});
 const staff=await staffRole(user,['admin','gerant']);
 const owner=rows[0].v2_client_auth_id===user.id;
 if(!owner&&!staff)return json(res,403,{error:'Accès à la conversation refusé'});
 const id=rows[0].id;
 if(req.method==='GET'){
  const messages=await sql`SELECT id,auth_user_id,sender_type,message,created_at
    FROM v2_order_messages WHERE order_id=${id} ORDER BY created_at ASC LIMIT 300`;
  return json(res,200,{messages:messages.map(m=>({...m,isMine:m.auth_user_id===user.id}))});
 }
 if(!only(req,res,'POST')||!validWriteOrigin(req,res))return;
 const msg=String(req.body?.message||'').trim();
 if(!msg||msg.length>2000)return json(res,400,{error:'Message invalide'});
 try{if(!await rateLimit(req,'v2_message',40,5))
  return json(res,429,{error:'Trop de messages, veuillez patienter'});
 }catch{return json(res,503,{error:'Messagerie momentanément indisponible'})}
 const role=staff?'staff':'client';
 const inserted=await sql`INSERT INTO v2_order_messages(order_id,auth_user_id,sender_type,message)
   VALUES(${id},${user.id},${role},${msg})
   RETURNING id,created_at`;
 if(role==='client'){
  await sql`INSERT INTO v2_notifications(user_auth_id,order_id,kind,title)
    SELECT auth_user_id,${id},'new_message','Nouveau message pour '||${orderNumber}
    FROM v2_user_roles WHERE enabled=true AND role IN('admin','gerant')`;
 }else if(rows[0].v2_client_auth_id){
  await sql`INSERT INTO v2_notifications(user_auth_id,order_id,kind,title)
    VALUES(${rows[0].v2_client_auth_id},${id},'new_message','Nouvelle réponse de JorsenShop')`;
 }
 return json(res,201,{ok:true,id:inserted[0].id});
}
