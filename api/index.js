// One Hobby-compatible function; preserve original handler authorization and input validation.
import admin_catalogue_import from '../server/admin/catalogue-import.js';
import admin_marketing from '../server/admin/marketing.js';
import admin_media_sign from '../server/admin/media-sign.js';
import admin_orders from '../server/admin/orders.js';
import admin_products from '../server/admin/products.js';
import health from '../server/health.js';
import investor_summary from '../server/investor/summary.js';
import marketing from '../server/marketing.js';
import order_status from '../server/order-status.js';
import orders from '../server/orders.js';
import products from '../server/products.js';
import products__id_ from '../server/products/[id].js';
import quote from '../server/quote.js';
import staff_login from '../server/staff/login.js';
import staff_session from '../server/staff/session.js';

const HANDLERS = Object.freeze({
  "admin/catalogue-import": admin_catalogue_import,
  "admin/marketing": admin_marketing,
  "admin/media-sign": admin_media_sign,
  "admin/orders": admin_orders,
  "admin/products": admin_products,
  "health": health,
  "investor/summary": investor_summary,
  "marketing": marketing,
  "order-status": order_status,
  "orders": orders,
  "products": products,
  "quote": quote,
  "staff/login": staff_login,
  "staff/session": staff_session,
});

export default async function handler(req, res) {
  let route = req.query?.route;
  if (Array.isArray(route)) route = route.join('/');
  if (typeof route !== 'string' || !route) {
    try { route = new URL(req.url, 'https://jorsenshop.invalid').pathname.replace(/^\/api\//, ''); }
    catch { route = ''; }
  }
  route = route.replace(/^\/+|\/+$/g, '');
  let matched = Object.hasOwn(HANDLERS, route) ? HANDLERS[route] : null;
  if (!matched && /^products\/[a-zA-Z0-9_-]{1,64}$/.test(route)) {
    // Preserve the old Vercel req.query.id contract for product details.
    req.query = {...req.query, id: route.slice('products/'.length)};
    matched = products__id_;
  }
  if (!matched) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({error: 'API introuvable'});
  }
  return matched(req, res);
}
