import {db,json,only} from '../../_lib/shared.js';
import {requireStaff,validWriteOrigin} from '../_lib/identity.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Méthode interdite'});
 const staff=await requireStaff(req,res);if(!staff)return;
 const sql=db();
 if(req.method==='GET'){
  const rows=await sql`SELECT o.id,o.order_number,o.customer_name,o.customer_phone,
    o.delivery_address,o.delivery_city,o.delivery_notes,o.item_subtotal_fc,
    o.delivery_fee_fc,o.total_fc,o.status,o.payment_status,o.v2_delivery_mode,
    o.v2_payment_provider,o.v2_shipping_agency,o.v2_tracking_number,
    o.v2_ready_at,o.created_at,COALESCE(
      (SELECT json_agg(json_build_object('name',i.product_name,'size',i.selected_size,
        'qty',i.quantity,'unitPrice',i.unit_price_fc)) FROM order_items i
        WHERE i.order_id=o.id),'[]'::json) AS items
    FROM orders o ORDER BY o.created_at DESC LIMIT 300`;
  return json(res,200,{orders:rows.map(o=>({...o,totalFc:Number(o.total_fc),feeFc:Number(o.delivery_fee_fc)}))});
 }
 if(!only(req,res,'POST')||!validWriteOrigin(req,res))return;
 const b=req.body||{},number=String(b.orderNumber||'');
 if(!/^JS-[0-9]{8}-[0-9]{6}$/.test(number))return json(res,400,{error:'Référence invalide'});
 try{
  if(b.action==='set-status'){
   if(!['confirmee','en_preparation','en_livraison','livree','annulee'].includes(b.status))
    return json(res,400,{error:'Statut invalide'});
   const rows=await sql`SELECT v2_staff_set_status(${number},${b.status},${staff.id}) AS result`;
   return json(res,200,rows[0].result);
  }
  if(b.action==='ready'){
   const rows=await sql`UPDATE orders SET v2_ready_at=now()
    WHERE order_number=${number} AND status='en_preparation'
    AND (lower(delivery_city)='lubumbashi' OR payment_status='payee')
    RETURNING id`;
   if(!rows.length)return json(res,409,{error:'Préparation incomplète ou paiement non confirmé'});
   return json(res,200,{ok:true});
  }
  if(b.action==='verify-payment'){
   const provider=String(b.provider||''),reference=String(b.reference||'').trim();
   if(!['airtel_money','orange_money','cash','other'].includes(provider)||reference.length>140)
    return json(res,400,{error:'Moyen de paiement ou référence incorrect'});
   const rows=await sql`SELECT total_fc FROM orders WHERE order_number=${number}`;
   if(!rows.length)return json(res,404,{error:'Commande inconnue'});
   const result=await sql`SELECT v2_verify_payment(${number},${staff.id},${rows[0].total_fc},
     ${provider},${reference}) AS result`;
   return json(res,200,result[0].result);
  }
  if(b.action==='assign-driver'){
   const courier=String(b.courierId||'');
   if(!courier||courier.length>200)return json(res,400,{error:'Livreur incorrect'});
   const valid=await sql`SELECT 1 FROM v2_user_roles
      WHERE auth_user_id=${courier} AND enabled AND role='livreur'`;
   if(!valid.length)return json(res,400,{error:'Compte livreur non autorisé'});
   const rows=await sql`SELECT id FROM orders WHERE order_number=${number}
      AND lower(delivery_city)='lubumbashi' AND v2_ready_at IS NOT NULL
      AND status='en_preparation'`;
   if(!rows.length)return json(res,409,{error:'Préparez le colis avant attribution'});
   const assigned=await sql`INSERT INTO v2_delivery_assignments(order_id,courier_auth_id,assigned_by)
      VALUES(${rows[0].id},${courier},${staff.id})
      ON CONFLICT(order_id) DO UPDATE SET courier_auth_id=EXCLUDED.courier_auth_id,
        assigned_by=EXCLUDED.assigned_by,status='assigned',assigned_at=now(),
        picked_up_at=NULL,delivered_at=NULL
      WHERE v2_delivery_assignments.status='assigned' RETURNING order_id`;
   if(!assigned.length)return json(res,409,{error:'Ce colis est déjà en cours de livraison'});
   await sql`INSERT INTO v2_notifications(user_auth_id,order_id,kind,title)
      VALUES(${courier},${rows[0].id},'delivery_assigned','Nouvelle mission : '||${number})`;
   return json(res,200,{ok:true});
  }
  if(b.action==='expedition'){
   const agency=String(b.agency||'').toUpperCase(),tracking=String(b.tracking||'').trim();
   if(!['KKS','NGOKAF'].includes(agency)||tracking.length>100)
    return json(res,400,{error:'Agence ou suivi invalide'});
   const rows=await sql`UPDATE orders SET v2_shipping_agency=${agency},
    v2_tracking_number=${tracking},v2_shipping_status='expediee',status='en_livraison'
    WHERE order_number=${number} AND lower(delivery_city)<>'lubumbashi'
       AND payment_status='payee' AND v2_ready_at IS NOT NULL
       AND status='en_preparation' RETURNING id`;
   if(!rows.length)return json(res,409,{error:'Paiement et préparation requis avant expédition'});
   await sql`INSERT INTO v2_order_events(order_id,actor_auth_id,from_status,to_status)
     VALUES(${rows[0].id},${staff.id},'en_preparation','expediee')`;
   await sql`INSERT INTO v2_notifications(user_auth_id,order_id,kind,title)
     SELECT v2_client_auth_id,id,'status_changed','Colis expédié : '||order_number
     FROM orders WHERE id=${rows[0].id} AND v2_client_auth_id IS NOT NULL`;
   return json(res,200,{ok:true});
  }
  return json(res,400,{error:'Action inconnue'});
 }catch(e){console.error('v2 admin order',e?.name);return json(res,409,{error:'Action impossible dans l’état actuel de la commande'})}
}
