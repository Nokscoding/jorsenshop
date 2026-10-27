import webpush from 'web-push';
import {db} from '../../_lib/shared.js';
// Delivery is best effort; commerce operations must never fail because of push.
export async function dispatchPendingPush(){
 if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return;
 try{
  webpush.setVapidDetails(process.env.PUBLIC_SITE_URL || 'https://jorsenshop.netlify.app',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  const sql=db();
  const rows=await sql`SELECT n.id,n.user_auth_id,n.kind,n.title FROM v2_notifications n
    WHERE n.push_sent_at IS NULL AND n.created_at>now()-interval '48 hours'
    AND EXISTS(SELECT 1 FROM v2_push_subscriptions s WHERE s.user_auth_id=n.user_auth_id)
    ORDER BY n.created_at LIMIT 12`;
  await Promise.all(rows.map(async n=>{
   const claim=await sql`UPDATE v2_notifications SET push_sent_at=now()
     WHERE id=${n.id} AND push_sent_at IS NULL RETURNING id`;
   if(!claim.length)return;
   const subs=await sql`SELECT endpoint,p256dh,auth_secret FROM v2_push_subscriptions
     WHERE user_auth_id=${n.user_auth_id} LIMIT 8`;let delivered=0;
   await Promise.all(subs.map(async s=>{
    try{
     await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth_secret}},
       JSON.stringify({title:n.title,body:'Ouvrez Jorsenshop pour consulter les détails.',
       url:n.kind==='delivery_assigned'?'/s/l6q8/':n.kind==='new_order'?'/s/a7m4/':'/#/compte/notifications',
       tag:'jorsenshop-'+n.id}),{TTL:3600});delivered++;
    }catch(e){if(e.statusCode===404||e.statusCode===410)
      await sql`DELETE FROM v2_push_subscriptions WHERE endpoint=${s.endpoint}`}
   }));
   if(!delivered)await sql`UPDATE v2_notifications SET push_sent_at=NULL WHERE id=${n.id}`;
  }));
 }catch(e){console.error('Push',e?.name)}
}