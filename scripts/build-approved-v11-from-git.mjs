// Build the user's approved original V1.1 source from Git, independently of temporary Drive links.
// The original files are stored losslessly as gzip+base64 under original-v11/.
// Never introduce a new theme here: only rewrite the media URLs to the dedicated Cloudinary CDN.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const files={
  'index.html':'28665d6b53186322a8aa1366c4604652912a812f78e1cf0cf05a15df52d0aa40',
  'app.js':'40837fa5675690ed96821c1a1a7ce50195efd82f5a940eeee88324eba204ae1f',
  'catalogue.js':'7eaf3ee08f65886d00a3936a155af19f18d4cdc7e3e730816ecfd9af65317c8d',
  'catalogue.json':'d9fbb965a18b6c772014f9c33ffc1528b891bdc909bf6d50cd3988b7c22a8907',
  'styles.css':'6008ae0f86f34c97546cfdfdf88109ebd2b70551880a3d0ea5bcb6b337e73b02',
  'mobile-first.css':'cf4a087bcf461ab70576c1799b2fa087efc371fefe9bd40289750094b3cd8d09',
  's/a7m4/index.html':'df3d9c65db3756a5b63972781a86416448006580bc6e1b84748bc8a8d50db42a',
  's/i9p2/index.html':'88de5e31b471d492ca0ca008a53f8152ef2221f6077e3fc0d86937dbce937870',
  's/l6q8/index.html':'33b05819c37ec695b220c032df986efde719ca865f2e6daf3518a1b1bbcbdea9',
  'assets/favicon.svg':'039f9d74e246e7a316b9e24ecfdb87f2f8247137a42f5227cc165a876792ca33'
};

for(const [name,hash] of Object.entries(files)){
  const encoded=await fs.readFile(path.join('original-v11',name+'.gz.b64'),'utf8');
  if(!/^[A-Za-z0-9+/=]+$/.test(encoded.trim()))throw Error('Corrupt archival source: '+name);
  const data=gunzipSync(Buffer.from(encoded.trim(),'base64'));
  const digest=createHash('sha256').update(data).digest('hex');
  if(digest!==hash)throw Error('Approved V1.1 SHA mismatch for '+name);
  const out=path.join('site',name);
  await fs.mkdir(path.dirname(out),{recursive:true});
  await fs.writeFile(out,data);
}
console.log('Restored original approved V1.1 layout: 10 files verified against original archive SHA-256.');

// Route approved interface media through Cloudinary WITHOUT redesigning its markup.
// All 278 product photos are now in the dedicated jrgtsxkt Cloudinary account.
// Image 098 is restored to the same dedicated Cloudinary account.
const appFile=path.join('site','app.js');
let app=await fs.readFile(appFile,'utf8');
const originalAsset="const asset = path => ROOT + path;";
if(!app.includes(originalAsset))throw Error('Cannot locate the original approved asset helper');
const cdn=[
  "const asset = path => {",
  " const m = typeof path === 'string' && path.match(/^assets\\/products\\/([0-9]{3})\\.webp$/);",
  " if(m && m[1]==='098')return 'https://res.cloudinary.com/jrgtsxkt/image/upload/f_auto,q_auto,c_limit,w_1600/jorsenshop/catalog/098.webp';",
  " if(m)return 'https://res.cloudinary.com/jrgtsxkt/image/upload/f_auto,q_auto,c_limit,w_1600/jorsenshop/catalog/'+m[1]+'.webp';",
  " if(path==='assets/logo-jorsenshop.png')return 'https://res.cloudinary.com/jrgtsxkt/image/upload/f_auto,q_auto,w_480/jorsenshop/branding/logo-jorsenshop.png';",
  " if(/^assets\\/videos\\/look-[12]\\.mp4$/.test(path))return 'https://res.cloudinary.com/jrgtsxkt/video/upload/q_auto/jorsenshop/lookbook/'+path.split('/').pop();",
  " return ROOT+path;",
  "};"
].join('\n');
app=app.replace(originalAsset,cdn);
await fs.writeFile(appFile,app,'utf8');
console.log('Media configured: all 278 product photos + logo + 2 lookbook videos from the dedicated Cloudinary account. No mockup design changes.');


// LIVREUR V1.1 ONLY: retain the approved UI for public/admin/investor roles.
// Filter mock missions to the selected demo driver; V2 must use authenticated identity.
const driverScope = "const assigned=orders.filter(o=>o.driver);const active=";
const driverScopeNew = "const assigned=orders.filter(o=>o.driver===get('demoCurrentDriver','Livreur démo'));const active=";
const driverBegin = app.indexOf("function driver(tab){");
const driverEnd = app.indexOf("function chatView(",driverBegin);
if(driverBegin < 0 || driverEnd <= driverBegin) throw Error("Approved courier controller not found");
const driverBlock = app.slice(driverBegin,driverEnd);
if(!driverBlock.includes(driverScope)) throw Error("Approved courier assignment marker not found");
app = app.slice(0,driverBegin) + driverBlock.replace(driverScope,driverScopeNew) + app.slice(driverEnd);
await fs.writeFile(appFile,app,'utf8');

// Only the courier HTML loads the extension. The three approved interfaces are untouched.
const driverHtmlPath = path.join('site','s/l6q8/index.html');
let driverHtml = await fs.readFile(driverHtmlPath,'utf8');
const courierScriptTag = '<script src="../../app.js"></script>';
if(!driverHtml.includes(courierScriptTag)) throw Error("Approved courier HTML script tag not found");
if(!(await fs.stat(path.join('site','driver-v11.js')).catch(()=>null))) throw Error("Missing courier extension");
// V2 only: do not inject the old courier demo enhancer.
await fs.writeFile(driverHtmlPath,driverHtml,'utf8');
console.log('Courrier preview: customer name, phone, address, instructions, assigned missions per demo driver. No production customer data.');


// V2 progressive enhancement: keep the approved V1.1 visual shell unchanged.
// The auth/shipping feature layer activates only when the V2 API is configured.
const publicHtmlPath=path.join('site','index.html');
let publicHtml=await fs.readFile(publicHtmlPath,'utf8');
const clientTag='<link rel="stylesheet" href="/v2-final.css"><script defer src="/v2-final.js"></script>';
if(!publicHtml.includes(clientTag)){
  if(!/<\/body>/i.test(publicHtml))throw Error('Original public HTML missing body close');
  publicHtml=publicHtml.replace(/<\/body>/i,clientTag+'\n</body>');
  await fs.writeFile(publicHtmlPath,publicHtml);
}


// The three professional spaces keep their original URL, header, brand and styles.
// Load the protected V2 data interface after the original markup; no demo transaction is promoted.
for(const rel of ['s/a7m4/index.html','s/i9p2/index.html','s/l6q8/index.html']){
 const target=path.join('site',rel);
 let html=await fs.readFile(target,'utf8');
 if(!/<\/body>/i.test(html))throw Error('Staff HTML structure missing: '+rel);
 const script='<script defer src="../../v2-staff.js"></script>';
 if(!html.includes(script)){
  html=html.replace(/<\/body>/i,script+'\n</body>');
  await fs.writeFile(target,html);
 }
}
// Use the familiar commercial name without changing the already-approved layout.
for(const rel of ['catalogue.js','catalogue.json','app.js']){
 const target=path.join('site',rel);
 let content=await fs.readFile(target,'utf8');
 content=content.replaceAll('Pull torsadé col camionneur','Pull quarter-zip torsadé');
 await fs.writeFile(target,content);
}



// Production legal pages and installable web app metadata survive the V1.1 reconstruction.
for(const rel of ['index.html','s/a7m4/index.html','s/i9p2/index.html','s/l6q8/index.html']){
 const target=path.join('site',rel);
 let html=await fs.readFile(target,'utf8');
 if(!html.includes('/legal.js'))html=html.replace(/<\/body>/i,'<script defer src="/legal.js"></script><script defer src="/push-client.js"></script>\n</body>');
 if(!html.includes('/manifest.webmanifest'))html=html.replace(/<\/head>/i,'<link rel="manifest" href="/manifest.webmanifest">\n<meta name="apple-mobile-web-app-capable" content="yes">\n</head>');
 await fs.writeFile(target,html,'utf8');
}

// Replace remaining static prototype captions without affecting layout or identifiers.
for(const rel of ['index.html','s/a7m4/index.html','s/i9p2/index.html','s/l6q8/index.html']){
 const target=path.join('site',rel);
 let html=await fs.readFile(target,'utf8');
 const replacements=[
  ['MAQUETTE D’INTERFACE','JORSENSHOP · BOUTIQUE'],
  ['MAQUETTE','JORSENSHOP'],
  ['Maquette','Jorsenshop'],
  ['DÉMONSTRATION','JORSENSHOP'],
  ['DÉMO','JORSENSHOP'],
  ['Prix fictifs','Prix en FC'],
  ['sans créer de compte','après connexion'],
  ['sans inscription','après connexion']
 ];
 for(const [before,after] of replacements)html=html.replaceAll(before,after);
 // The original static metadata still calls the website a demonstration.
 html=html.replaceAll('Boutique de démonstration','Boutique en ligne');
 html=html.replaceAll('boutique de démonstration','boutique en ligne');
 await fs.writeFile(target,html,'utf8');
}
// Live catalogue toggle: retain V1 layout, but never sell mock items.
// JS functions continue using the same product renderer; only its backing array changes.
{
 let live=await fs.readFile(appFile,'utf8');
 const v2Hooks=[["function account(tab){","function account(tab){if(typeof window.JORSEN_V2_ACCOUNT_RENDER==='function')return window.JORSEN_V2_ACCOUNT_RENDER(tab||'accueil');return '<main class=\"j2-page\">Chargement du compte…</main>';"],["function checkout(){","function checkout(){if(typeof window.JORSEN_V2_CHECKOUT_RENDER==='function')return window.JORSEN_V2_CHECKOUT_RENDER();return '<main class=\"j2-page\">Chargement de la commande…</main>';"],["function admin(tab){","function admin(tab){if(PORTAL==='admin')return '<main class=\"jsv2-secure\">Espace gérant sécurisé — Connexion requise</main>';"],["function investor(tab){","function investor(tab){if(PORTAL==='investisseur')return '<main class=\"jsv2-secure\">Espace investisseur sécurisé — Connexion requise</main>';"],["function driver(tab){","function driver(tab){if(PORTAL==='livreur')return '<main class=\"jsv2-secure\">Espace livreur sécurisé — Connexion requise</main>';"]];
 for(const [before,after] of v2Hooks){
  if(!live.includes(before))throw Error('V1.1 UI hook not found: '+before);
  live=live.replace(before,after);
 }
 const productsMarker=".concat(get('customProducts',[]))";
 if(!live.includes(productsMarker))throw Error('Approved products renderer changed: review required');
 live=live.replace(productsMarker,".concat(window.JORSEN_LIVE_MODE?[]:get('customProducts',[]))");
 const endpointMarker='\nrender();\n})();';
 if(!live.includes(endpointMarker))throw Error('Approved app closing marker not found');
 live=live.replace(endpointMarker,[
 '\nwindow.JORSEN_SET_LIVE_CATALOGUE = function(items){',
 " if(!Array.isArray(items))return;",
 " window.JORSEN_LIVE_MODE=true;window.JORSEN_CATALOG=items;",
 " window.JORSEN_CART_ITEMS = function(){return cart.map(x=>({...x}));};",
 " window.JORSEN_V2_RENDER=render;",
 " window.JORSEN_V2_FAVORITES=function(){return wishlist.map(id=>byId(id)).filter(Boolean);};",
 " window.JORSEN_CLEAR_CART = function(){cart=[];put('cart',[]);render();};",
 " BASE.splice(0,BASE.length,...items);",
 " overrides={};cart=cart.filter(c=>items.some(p=>p.id===c.id && p.variants?.[c.variant]?.id));put('cart',cart);",
 " // User accounts and real orders are managed by the final frontend.",
 " render();",
 "};",
 endpointMarker
 ].join('\n'));
 // Staff workspaces are real; remove the obsolete V1.1 demo label from their header.
 const staffDemo='<span class="staff-demo-mark">DÉMO</span>';
 if(!live.includes(staffDemo))throw Error('Missing obsolete V1 staff badge');
 live=live.replaceAll(staffDemo,'');
 live=live.replaceAll('Maquette locale sans connexion ni protection d’accès — données fictives.', 'Espace professionnel sécurisé');
 // Replace V1.1 demo-only customer copy without altering the approved interface layout.
 // Prices can be modified by the manager; do not advertise fictional checkout flows.
 const customerCopy=[
  ["MAQUETTE D’INTERFACE","JORSENSHOP · BOUTIQUE"],
  ["Aucun paiement réel","Livraison selon votre ville"],
  ["Prix d'exemple en FC","Prix en FC"],
  ["Prix démo","Prix en FC"],
  ["LIVRAISON À LUBUMBASHI","LIVRAISON EN RDC"],
  ["Cette commande reste une simulation locale.","Connectez-vous pour confirmer votre commande."],
  ["Les commandes restent enregistrées uniquement dans ce navigateur.","Consultez les informations de vos commandes ci-dessous."]
 ];
 for(const [from,to] of customerCopy)live=live.replaceAll(from,to);
 // Final storefront copy: original V1.1 footer and hero still contain demo labels.
 // Those strings live in app.js (generated by the approved archive), NOT in index.html.
 const storefrontCopy=[
  ['Catalogue et fonctionnalités de démonstration.','Découvrez nos collections et nos nouveautés.'],
  ['Catalogue et fonctionnalités de démonstration','Découvrez nos collections et nos nouveautés'],
  ['Prototype V1 · sans base de données · FC','Boutique en ligne · Lubumbashi, RDC'],
  ['Prototype V1 • sans base de données • FC','Boutique en ligne · Lubumbashi, RDC'],
  ['Prototype V1','Boutique Jorsenshop'],
  ['sans base de données','avec gestion des commandes en ligne'],
  ['Boutique de démonstration','Boutique de vêtements en ligne'],
  ['boutique de démonstration','boutique de vêtements en ligne'],
  ['fonctionnalités de démonstration','services de la boutique'],
  ['Fonctionnalités de démonstration','Services de la boutique'],
  ['catalogue de démonstration','catalogue Jorsenshop'],
  ['Catalogue de démonstration','Catalogue Jorsenshop'],
  ['sans commande réelle','avec suivi des commandes'],
  ['Données fictives','Informations de la boutique'],
  ['données fictives','informations de la boutique']
 ];
 for(const [from,to] of storefrontCopy)live=live.replaceAll(from,to);
 // Catch punctuation/whitespace variants while preserving the approved layout.
 live=live.replace(/Prototype\s*V1\s*[·•-]\s*sans base de données\s*[·•-]\s*FC/gi,
  'Boutique en ligne · Lubumbashi, RDC');
 live=live.replace(/Catalogue et fonctionnalit(?:é|e)s de d(?:é|e)monstration\.?/gi,
  'Découvrez nos collections et nos nouveautés.');
 if(/Prototype\s*V1|sans base de données|fonctionnalit(?:é|e)s de d(?:é|e)monstration/i.test(live))
  throw Error('A storefront demo label survived the approved V1.1 rebuild');
 // V2 published Neon products carry full Cloudinary URLs; return them as-is.
 live=live.replace('return ROOT+path;',[
 " if(typeof path==='string' && /^https:\\/\\/res\\.cloudinary\\.com\\/jrgtsxkt\\/image\\/upload\\//.test(path))return path;",
 ' return ROOT+path;'
 ].join('\n'));
 await fs.writeFile(appFile,live,'utf8');
}
