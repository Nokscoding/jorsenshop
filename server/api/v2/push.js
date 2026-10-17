import {db,json} from '../_lib/shared.js';
import {requireUser,validWriteOrigin} from './_lib/identity.js';
const trusted=h=>h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||
 h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com')||h.endsWith('.push.services.mozilla.com');
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const key=process.env.VAPID_PUBLIC_KEY||'';
 if(req.method==='GET')return json(res,200,{enabled:!!(key&&process.env.VAPID_PRIVATE_KEY),publicKey:key});
 if(!['POST','DELETE'].includes(req.method))return json(res,405,{error:'Méthode interdite'});
 const user=await requireUser(req,res);if(!user||!validWriteOrigin(req,res))return;
 const s=req.body?.subscription||{},endpoint=String(s.endpoint||'');let url;
 try{url=new URL(endpoint)}catch{return json(res,400,{error:'Souscription invalide'})}
 if(url.protocol!=='https:'||!trusted(url.hostname)||endpoint.length>2048)
  return json(res,400,{error:'Service push non autorisé'});
 const sql=db();
 if(req.method==='DELETE'){await sql`DELETE FROM v2_push_subscriptions WHERE endpoint=${endpoint} AND user_auth_id=${user.id}`;return json(res,200,{ok:true})}
 if(!process.env.VAPID_PRIVATE_KEY||!key)return json(res,503,{error:'Service push non configuré'});
 const p256dh=String(s.keys?.p256dh||''),auth=String(s.keys?.auth||'');
 if(!/^[A-Za-z0-9_-]{50,150}$/.test(p256dh)||!/^[A-Za-z0-9_-]{10,100}$/.test(auth))
  return json(res,400,{error:'Clés push invalides'});
 await sql`INSERT INTO v2_push_subscriptions(endpoint,user_auth_id,p256dh,auth_secret)
  VALUES(${endpoint},${user.id},${p256dh},${auth})
  ON CONFLICT(endpoint) DO UPDATE SET user_auth_id=EXCLUDED.user_auth_id,p256dh=EXCLUDED.p256dh,auth_secret=EXCLUDED.auth_secret`;
 return json(res,200,{ok:true});
}