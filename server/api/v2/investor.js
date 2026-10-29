import {db,json} from '../_lib/shared.js';
import {requireStaff} from './_lib/identity.js';

const toNumber = value => Number(value ?? 0);
const SHARE_RATE = 30;
const PAGE_SIZE = 50;

// All finance figures come from verified receipts, never from pending orders.
// Post-promotion item_subtotal_fc is used, not the original sum of order_items:
// a basket-level promo code reduces the net sales and the gross margin.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return json(res,405,{error:'Méthode interdite'});
 const staff=await requireStaff(req,res,['admin','investisseur','gerant']);if(!staff)return;
 const page=Math.max(1,Math.min(100000,Number.parseInt(String(req.query?.page||'1'),10)||1));
 const offset=(page-1)*PAGE_SIZE;
 try{
  const sql=db();
  const [monthlyRows,saleRows,expenses,agreements,pendingCashRows]=await Promise.all([
   sql`SELECT to_char(date_trunc('month',o.paid_at),'YYYY-MM') AS month,
     count(*) AS paid_orders,
     coalesce(sum(o.total_fc),0) AS cash_received_fc,
     coalesce(sum(o.item_subtotal_fc),0) AS product_sales_fc,
     coalesce(sum(o.delivery_fee_fc),0) AS delivery_fees_fc,
     coalesce(sum(o.discount_fc),0) AS discounts_fc,
     coalesce(sum(cost.purchase_costs_fc),0) AS purchase_costs_fc,
     coalesce(sum(cost.missing_cost_lines),0) AS missing_cost_lines,
     coalesce(sum(CASE WHEN cost.missing_cost_lines=0
       THEN o.item_subtotal_fc-cost.purchase_costs_fc ELSE 0 END),0) AS known_gross_profit_fc,
     coalesce(sum(CASE WHEN cost.missing_cost_lines=0
       THEN round(greatest(o.item_subtotal_fc-cost.purchase_costs_fc,0)*0.30)
       ELSE 0 END),0) AS known_nks_share_fc
    FROM orders o CROSS JOIN LATERAL (
     SELECT coalesce(sum(i.unit_purchase_cost_fc*i.quantity),0) AS purchase_costs_fc,
       count(*) FILTER (WHERE i.unit_purchase_cost_fc IS NULL)
       + CASE WHEN count(*)=0 THEN 1 ELSE 0 END AS missing_cost_lines
     FROM order_items i WHERE i.order_id=o.id
    ) cost
    WHERE o.payment_status='payee' AND o.paid_at IS NOT NULL
    GROUP BY date_trunc('month',o.paid_at) ORDER BY month DESC`,
   sql`SELECT o.order_number,o.customer_name,o.paid_at,o.payment_method,o.v2_payment_provider,
     o.item_subtotal_fc,o.delivery_fee_fc,o.total_fc,o.discount_fc,o.promo_code,
     o.status, cost.purchase_costs_fc,cost.missing_cost_lines,cost.items
    FROM orders o CROSS JOIN LATERAL (
      SELECT coalesce(sum(i.unit_purchase_cost_fc*i.quantity),0) AS purchase_costs_fc,
       count(*) FILTER (WHERE i.unit_purchase_cost_fc IS NULL)
         + CASE WHEN count(*)=0 THEN 1 ELSE 0 END AS missing_cost_lines,
       coalesce(json_agg(json_build_object('name',i.product_name,'qty',i.quantity,
         'unitPriceFc',i.unit_price_fc,'lineTotalFc',i.line_total_fc) ORDER BY i.product_name)
         FILTER (WHERE i.id IS NOT NULL),'[]'::json) AS items
      FROM order_items i WHERE i.order_id=o.id
    ) cost
    WHERE o.payment_status='payee' AND o.paid_at IS NOT NULL
    ORDER BY o.paid_at DESC,o.order_number DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
   sql`SELECT to_char(date_trunc('month',incurred_at),'YYYY-MM') AS month,
     sum(amount_fc) AS amount_fc FROM expenses GROUP BY 1 ORDER BY 1 DESC LIMIT 24`,
   sql`SELECT name,percentage,basis,starts_on,ends_on FROM revenue_agreements
     WHERE signed_at IS NOT NULL ORDER BY created_at DESC LIMIT 8`,
   sql`SELECT count(*) AS pending_deliveries,
     coalesce(sum(d.cash_collected_fc),0) AS unverified_cash_fc
    FROM v2_delivery_assignments d JOIN orders o ON o.id=d.order_id
    WHERE d.status='delivered' AND o.payment_status<>'payee'
      AND coalesce(d.cash_collected_fc,0)>0`
  ]);
  const monthly=monthlyRows.map(row=>{
   const missingCosts=toNumber(row.missing_cost_lines),revenueFc=toNumber(row.product_sales_fc),
     purchaseCostsFc=toNumber(row.purchase_costs_fc);
   return {month:row.month,orders:toNumber(row.paid_orders),
     cashReceivedFc:toNumber(row.cash_received_fc),revenueFc,
     deliveryFeesFc:toNumber(row.delivery_fees_fc),
     discountsFc:toNumber(row.discounts_fc),purchaseCostsFc,missingCosts,
     grossProfitFc:missingCosts?null:toNumber(row.known_gross_profit_fc),
     nksShareFc:missingCosts?null:toNumber(row.known_nks_share_fc)};
  });
  const totals={
   orders:monthly.reduce((sum,x)=>sum+x.orders,0),
   cashReceivedFc:monthly.reduce((sum,x)=>sum+x.cashReceivedFc,0),
   revenueFc:monthly.reduce((sum,x)=>sum+x.revenueFc,0),
   deliveryFeesFc:monthly.reduce((sum,x)=>sum+x.deliveryFeesFc,0),
   discountsFc:monthly.reduce((sum,x)=>sum+x.discountsFc,0),
   purchaseCostsFc:monthly.reduce((sum,x)=>sum+x.purchaseCostsFc,0),
   missingCosts:monthly.reduce((sum,x)=>sum+x.missingCosts,0),
   grossProfitFc:monthly.some(x=>x.grossProfitFc===null)?null:
     monthly.reduce((sum,x)=>sum+x.grossProfitFc,0),
   nksShareFc:monthly.some(x=>x.nksShareFc===null)?null:
     monthly.reduce((sum,x)=>sum+x.nksShareFc,0)
  };
  const sales=saleRows.map(row=>{
   const missingCosts=toNumber(row.missing_cost_lines);
   const revenueFc=toNumber(row.item_subtotal_fc),purchaseCostsFc=toNumber(row.purchase_costs_fc);
   const grossProfitFc=missingCosts?null:revenueFc-purchaseCostsFc;
   return {orderNumber:row.order_number,customerName:row.customer_name,paidAt:row.paid_at,
     paymentMethod:row.v2_payment_provider||row.payment_method,status:row.status,
     revenueFc,cashReceivedFc:toNumber(row.total_fc),
     deliveryFeesFc:toNumber(row.delivery_fee_fc),discountsFc:toNumber(row.discount_fc),
     promoCode:row.promo_code,purchaseCostsFc,missingCosts,grossProfitFc,
     nksShareFc:grossProfitFc===null?null:Math.round(Math.max(0,grossProfitFc)*SHARE_RATE/100),
     items:row.items||[]};
  });
  return json(res,200,{monthly,totals,sales,pagination:{page,pageSize:PAGE_SIZE,
    total:totals.orders,pages:Math.max(1,Math.ceil(totals.orders/PAGE_SIZE))},
   pendingCash:{deliveries:toNumber(pendingCashRows[0]?.pending_deliveries),
     unverifiedFc:toNumber(pendingCashRows[0]?.unverified_cash_fc)},
   expenses:expenses.map(x=>({month:x.month,amountFc:toNumber(x.amount_fc)})),
   agreements:agreements.map(x=>({...x,percentage:toNumber(x.percentage)})),
   compensation:{rate:SHARE_RATE,basis:'30 % de la marge brute positive de chaque commande payée, avant charges générales, après remises, hors frais de livraison',
     automaticCalculation:true,automaticTransfer:false},
   note:'Seuls les paiements confirmés entrent dans les recettes. L’argent déclaré par le livreur mais non vérifié est séparé. Sans coût d’achat enregistré à la vente, la part NKS reste indéterminée.'});
 }catch(e){console.error('Investor report',e?.name);return json(res,503,{error:'Rapports momentanément indisponibles'})}
}
