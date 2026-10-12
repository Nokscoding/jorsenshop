import {db,json,only} from '../_lib/shared.js';
import {requireUser,validWriteOrigin} from './_lib/identity.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Méthode interdite'});
 const user=await requireUser(req,res);if(!user)return;
 const sql=db();
 if(req.method==='GET'){
  const rows=await sql`SELECT n.id,n.kind,n.title,n.is_read,n.created_at,o.order_number
   FROM v2_notifications n LEFT JOIN orders o ON o.id=n.order_id
   WHERE n.user_auth_id=${user.id} ORDER BY n.created_at DESC LIMIT 60`;
  return json(res,200,{unread:rows.filter(x=>!x.is_read).length,notifications:rows});
 }
 if(!only(req,res,'POST')||!validWriteOrigin(req,res))return;
 const id=String(req.body?.id||'');
 if(!/^[a-f0-9-]{36}$/i.test(id))return json(res,400,{error:'Notification invalide'});
 await sql`UPDATE v2_notifications SET is_read=true WHERE id=${id} AND user_auth_id=${user.id}`;
 return json(res,200,{ok:true});
}
