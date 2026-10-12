import {db,json} from '../_lib/shared.js';
import {requireStaff} from './_lib/identity.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return json(res,405,{error:'Méthode interdite'});
 const staff=await requireStaff(req,res,['admin','investisseur']);if(!staff)return;
 try{
  const sql=db();
  const [monthly,expenses,agreements]=await Promise.all([
   sql`SELECT to_char(month,'YYYY-MM') month,paid_orders,product_sales_fc
      FROM paid_product_sales ORDER BY month DESC LIMIT 24`,
   sql`SELECT to_char(date_trunc('month',incurred_at),'YYYY-MM') month,
      sum(amount_fc) amount_fc FROM expenses GROUP BY 1 ORDER BY 1 DESC LIMIT 24`,
   sql`SELECT name,percentage,basis,starts_on,ends_on FROM revenue_agreements
      WHERE signed_at IS NOT NULL ORDER BY created_at DESC LIMIT 8`
  ]);
  return json(res,200,{monthly:monthly.map(x=>({month:x.month,orders:Number(x.paid_orders),
    revenueFc:Number(x.product_sales_fc)})),expenses:expenses.map(x=>({month:x.month,amountFc:Number(x.amount_fc)})),
    agreements:agreements.map(x=>({...x,percentage:Number(x.percentage)})),
    note:'Les ventes sont comptabilisées uniquement après vérification du paiement.'});
 }catch{return json(res,503,{error:'Rapports momentanément indisponibles'})}
}
