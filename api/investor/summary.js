import {db,json,only,requireRole} from '../_lib/shared.js';
export default async function handler(req,res){
 if(!only(req,res,'GET')||!requireRole(req,res,'admin','investisseur'))return;
 try{
  const sql=db();
  const [monthly,agreements,expenses]=await Promise.all([
   sql`SELECT to_char(month,'YYYY-MM') AS month,paid_orders,product_sales_fc FROM paid_product_sales ORDER BY month DESC LIMIT 12`,
   sql`SELECT name,percentage,basis,starts_on,ends_on FROM revenue_agreements WHERE signed_at IS NOT NULL AND (ends_on IS NULL OR ends_on>=CURRENT_DATE) ORDER BY created_at DESC`,
   sql`SELECT to_char(date_trunc('month',incurred_at),'YYYY-MM') AS month,COALESCE(sum(amount_fc),0) AS amount_fc FROM expenses GROUP BY 1 ORDER BY 1 DESC LIMIT 12`
  ]);
  return json(res,200,{monthly:monthly.map(m=>({month:m.month,orders:Number(m.paid_orders),revenueFc:Number(m.product_sales_fc)})),
     expenses:expenses.map(e=>({month:e.month,amountFc:Number(e.amount_fc)})),
     agreements:agreements.map(a=>({name:a.name,percentage:Number(a.percentage),basis:a.basis,start:a.starts_on,end:a.ends_on}))});
 }catch(e){console.error(e.name);return json(res,503,{error:'Rapports momentanément indisponibles'})}
}
