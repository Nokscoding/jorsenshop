import {db,json,only,requireRole} from '../_lib/shared.js';
export default async function handler(req,res){
 if(!requireRole(req,res,'admin'))return;
 const sql=db();
 if(req.method==='GET'){
  try{
   const orders=await sql`SELECT o.id,o.order_number,o.customer_name,o.customer_phone,
     o.delivery_address,o.delivery_city,o.delivery_notes,o.item_subtotal_fc,o.delivery_fee_fc,o.total_fc,
     o.status,o.payment_status,o.created_at,
       COALESCE((SELECT json_agg(json_build_object('name',i.product_name,'color',i.selected_color,'size',i.selected_size,
         'qty',i.quantity,'unitPrice',i.unit_price_fc)) FROM order_items i WHERE i.order_id=o.id),'[]'::json) AS items
     FROM orders o ORDER BY o.created_at DESC LIMIT 300`;
   return json(res,200,{orders:orders.map(o=>({...o,total:Number(o.total_fc),subtotal:Number(o.item_subtotal_fc)}))});
  }catch(e){console.error(e.name);return json(res,503,{error:'Commandes indisponibles'})}
 }
 if(!only(req,res,'POST'))return;
 const number=String(req.body?.orderNumber||''),status=req.body?.status??null,paid=req.body?.paid===true;
 if(!/^JS-[0-9]{8}-[0-9]{6}$/.test(number))return json(res,400,{error:'Référence incorrecte'});
 if(status!==null&&!['a_confirmer','confirmee','en_preparation','en_livraison','livree','annulee'].includes(status))
   return json(res,400,{error:'Statut invalide'});
 try{
  const rows=await sql`SELECT staff_update_order(${number},${status},${paid}) AS result`;
  await sql`INSERT INTO audit_log(action,resource_type,resource_id,metadata) VALUES('update_order','order',${number},${JSON.stringify({status,paid})}::jsonb)`;
  return json(res,200,rows[0].result);
 }catch(e){console.error(e.name);return json(res,409,{error:'Modification impossible : vérifier le statut et les encaissements'})}
}
