import {db,json,rateLimit} from '../_lib/shared.js';
import {requireStaff,validWriteOrigin} from './_lib/identity.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const sql=db();
 if(req.method==='GET'){
  const staff=await requireStaff(req,res,['admin','gerant']);if(!staff)return;
  const rows=await sql`SELECT id,name,reply_to,topic,message,state,created_at
     FROM v2_contact_messages ORDER BY created_at DESC LIMIT 100`;
  return json(res,200,{messages:rows});
 }
 if(req.method!=='POST')return json(res,405,{error:'Méthode interdite'});
 if(!validWriteOrigin(req,res))return;
 const body=req.body||{};
 if(body.website)return json(res,200,{ok:true});
 const name=String(body.name||'').trim(),replyTo=String(body.replyTo||'').trim(),
  topic=String(body.topic||'').trim(),message=String(body.message||'').trim();
 if(name.length<2||name.length>100||replyTo.length<5||replyTo.length>200||
  !['Commande et livraison','Protection de mes données','Autre demande'].includes(topic)||
  message.length<10||message.length>2500)return json(res,400,{error:'Complétez les champs du formulaire'});
 try{
  if(!await rateLimit(req,'public_contact',5,60))return json(res,429,{error:'Trop de messages envoyés'});
  await sql`INSERT INTO v2_contact_messages(name,reply_to,topic,message)
   VALUES(${name},${replyTo},${topic},${message})`;
  return json(res,201,{ok:true});
 }catch(e){console.error('Contact',e?.name);return json(res,503,{error:'Envoi momentanément indisponible'})}
}