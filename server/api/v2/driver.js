import {dispatchPendingPush} from './_lib/push-dispatch.js';
import {db,json,only} from '../_lib/shared.js';
import {requireStaff,validWriteOrigin} from './_lib/identity.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Méthode interdite'});
 const driver=await requireStaff(req,res,['livreur']);if(!driver)return;
 const sql=db();
 if(req.method==='GET'){
  const rows=await sql`SELECT d.order_id,d.status AS delivery_status,d.assigned_at,
    o.order_number,o.customer_name,o.customer_phone,o.delivery_address,o.delivery_city,
    o.delivery_notes,o.total_fc,o.payment_status,o.status AS order_status,
    COALESCE((SELECT json_agg(json_build_object('name',i.product_name,'size',i.selected_size,
      'color',i.selected_color,'qty',i.quantity)) FROM order_items i WHERE i.order_id=o.id),'[]'::json) AS items
    FROM v2_delivery_assignments d JOIN orders o ON o.id=d.order_id
    WHERE d.courier_auth_id=${driver.id} ORDER BY d.assigned_at DESC LIMIT 100`;
  return json(res,200,{deliveries:rows.map(x=>({...x,totalFc:Number(x.total_fc)}))});
 }
 if(!only(req,res,'POST')||!validWriteOrigin(req,res))return;
 const id=String(req.body?.orderId||''),action=String(req.body?.action||''),
   amount=Number(req.body?.cashCollectedFc||0),reason=String(req.body?.reason||'').trim();
 if(!/^[a-f0-9-]{36}$/i.test(id)||!['picked_up','delivered','failed'].includes(action)||
   !Number.isSafeInteger(amount)||amount<0||reason.length>400)
  return json(res,400,{error:'Données invalides'});
 try{
  const rows=await sql`SELECT v2_driver_progress(${id}::uuid,${driver.id},${action},
     ${amount},${reason}) AS result`;
  await dispatchPendingPush();
  return json(res,200,rows[0].result);
 }catch(e){console.error('v2 driver progress',e?.name);
  return json(res,409,{error:'Cette livraison ne peut pas être modifiée'})}
}
