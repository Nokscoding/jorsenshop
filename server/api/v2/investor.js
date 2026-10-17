import {db,json} from '../_lib/shared.js';
import {requireStaff} from './_lib/identity.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return json(res,405,{error:'Méthode interdite'});
 const staff=await requireStaff(req,res,['admin','investisseur']);if(!staff)return;
 try{
  const sql=db();
  const [sales,expenses,agreements]=await Promise.all([
   sql`SELECT to_char(date_trunc('month',o.paid_at),'YYYY-MM') AS month,
     count(DISTINCT o.id) AS paid_orders,coalesce(sum(i.line_total_fc),0) AS product_sales_fc,
     coalesce(sum(i.unit_purchase_cost_fc*i.quantity),0) AS purchase_costs_fc,
     count(*) FILTER(WHERE i.unit_purchase_cost_fc IS NULL) AS missing_cost_lines
     FROM orders o JOIN order_items i ON i.order_id=o.id
     WHERE o.payment_status='payee' AND o.paid_at IS NOT NULL
     GROUP BY date_trunc('month',o.paid_at) ORDER BY month DESC LIMIT 24`,
   sql`SELECT to_char(date_trunc('month',incurred_at),'YYYY-MM') AS month,
     sum(amount_fc) amount_fc FROM expenses GROUP BY 1 ORDER BY 1 DESC LIMIT 24`,
   sql`SELECT name,percentage,basis,starts_on,ends_on FROM revenue_agreements
     WHERE signed_at IS NOT NULL ORDER BY created_at DESC LIMIT 8`
  ]);
  const monthly=sales.map(row=>{
   const revenueFc=Number(row.product_sales_fc),purchaseCostsFc=Number(row.purchase_costs_fc),
    missingCosts=Number(row.missing_cost_lines);
   const grossProfitFc=missingCosts?null:revenueFc-purchaseCostsFc;
   return {month:row.month,orders:Number(row.paid_orders),revenueFc,purchaseCostsFc,
    missingCosts,grossProfitFc,nksShareFc:grossProfitFc===null?null:Math.round(Math.max(0,grossProfitFc)*.30)};
  });
  return json(res,200,{monthly,expenses:expenses.map(x=>({month:x.month,amountFc:Number(x.amount_fc)})),
   agreements:agreements.map(x=>({...x,percentage:Number(x.percentage)})),
   compensation:{rate:30,basis:'Marge brute des articles encaissés, avant charges générales, hors frais de livraison',
    status:'declared_by_parties',automaticTransfer:false},
   note:'Montants comptabilisés après confirmation du paiement. Une marge inconnue n’est jamais affichée comme zéro.'});
 }catch(e){console.error('Investor report',e?.name);return json(res,503,{error:'Rapports momentanément indisponibles'})}
}