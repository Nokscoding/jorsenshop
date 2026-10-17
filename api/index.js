// Single Vercel Hobby function for all existing V1/V2 APIs; role/security checks stay in each handler.
import m0 from '../server/api/admin/catalogue-import.js';
import m1 from '../server/api/admin/media-sign.js';
import m2 from '../server/api/admin/orders.js';
import m3 from '../server/api/admin/products.js';
import m4 from '../server/api/health.js';
import m5 from '../server/api/investor/summary.js';
import m6 from '../server/api/order-status.js';
import m7 from '../server/api/orders.js';
import m8 from '../server/api/products.js';
import m9 from '../server/api/products/[id].js';
import m10 from '../server/api/staff/login.js';
import m11 from '../server/api/staff/session.js';
import m12 from '../server/api/v2/admin/catalogue.js';
import m13 from '../server/api/v2/admin/drivers.js';
import m14 from '../server/api/v2/admin/media-sign.js';
import m15 from '../server/api/v2/admin/orders.js';
import m16 from '../server/api/v2/admin/roles.js';
import m17 from '../server/api/v2/auth.js';
import m18 from '../server/api/v2/chat.js';
import m19 from '../server/api/v2/cities.js';
import m20 from '../server/api/v2/driver.js';
import m21 from '../server/api/v2/investor.js';
import m22 from '../server/api/v2/me.js';
import m23 from '../server/api/v2/notifications.js';
import m24 from '../server/api/v2/orders.js';
import m25 from '../server/api/v2/shipping-quote.js';
import m26 from '../server/api/v2/staff.js';
import m27 from '../server/api/v2/contact.js';
import m28 from '../server/api/v2/push.js';
const routes=Object.freeze({
  'admin/catalogue-import':m0,
  'admin/media-sign':m1,
  'admin/orders':m2,
  'admin/products':m3,
  'health':m4,
  'investor/summary':m5,
  'order-status':m6,
  'orders':m7,
  'products':m8,
  'products/[id]':m9,
  'staff/login':m10,
  'staff/session':m11,
  'v2/admin/catalogue':m12,
  'v2/admin/drivers':m13,
  'v2/admin/media-sign':m14,
  'v2/admin/orders':m15,
  'v2/admin/roles':m16,
  'v2/auth':m17,
  'v2/chat':m18,
  'v2/cities':m19,
  'v2/driver':m20,
  'v2/investor':m21,
  'v2/me':m22,
  'v2/notifications':m23,
  'v2/orders':m24,
  'v2/shipping-quote':m25,
  'v2/staff':m26,
  'v2/contact':m27,
  'v2/push':m28
});
export default async function handler(req,res){
 try{
  const u=new URL(req.url||'/', 'https://jorsenshop.invalid');
  const raw=String(req.query?.route||u.searchParams.get('route')||u.pathname.replace(/^\/api\//,'')).trim();
  const target=decodeURIComponent(raw).replace(/^\/+|\/+$/g,'');
  if(target.length>150||!target.split('/').every(seg=>/^[a-z0-9-]+$/i.test(seg)))
   return res.status(404).json({error:'Route inconnue'});
  const dynamic=target.startsWith('products/') && target.split('/').length===2 && target!=='products/[id]';
  const route=dynamic?'products/[id]':target;
  const fn=routes[route];
  if(!fn)return res.status(404).json({error:'Route inconnue'});
  req.query={...Object.fromEntries(u.searchParams),...req.query};
  if(dynamic)req.query.id=target.slice('products/'.length);
  return await fn(req,res);
 }catch(e){console.error('JorsenShop API dispatch',e?.name);return res.status(500).json({error:'Service momentanément indisponible'})}
}
