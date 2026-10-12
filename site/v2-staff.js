/* JorsenShop V2 — live staff portal enhancement. Reuses approved header, colors and mobile layout. */
(() => {
'use strict';
const portal=window.JORSEN_PORTAL;
if(!['admin','investisseur','livreur'].includes(portal))return;
const $=(s,r=document)=>r.querySelector(s);
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=x=>new Intl.NumberFormat('fr-FR').format(Number(x)||0)+' FC';
const api=async(path,options={})=>{
 const r=await fetch('/api/v2/'+path,{credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json'},...options});
 const o=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(o.error||'Service indisponible');return o;
};
let profile=null,data={},tab='accueil',popup=null,loaded=false,unread=0;
const css=document.createElement('style');
css.textContent=[
'.jsv2-backdrop{position:fixed;inset:0;z-index:16000;display:grid;place-items:center;background:#f5f9fb;padding:18px}',
'.jsv2-login{width:min(100%,420px);padding:28px;border-radius:19px;background:white;box-shadow:0 15px 60px #0b20341a;color:#132d43}',
'.jsv2-login h1{font-size:26px;line-height:1.2}.jsv2-login p{font-size:13px;color:#687f8a;line-height:1.6}',
'.jsv2-login label{font-size:13px;display:block;font-weight:700;margin:15px 0 0}',
'.jsv2-login input,.jsv2-login select{display:block;width:100%;font-size:16px;margin-top:6px;padding:12px;border:1px solid #d6e1e7;border-radius:10px;box-sizing:border-box}',
'.jsv2-btn{border:0;background:#112b49;color:white;font-weight:800;border-radius:10px;padding:12px 17px;cursor:pointer}',
'.jsv2-login .jsv2-btn{width:100%;margin-top:20px}',
'.jsv2-note{margin:12px 0;color:#41596a;padding:12px;background:#eef8f7;border-radius:9px;font-size:13px}',
'.jsv2-head{display:flex;justify-content:space-between;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:15px}',
'.jsv2-tabs{display:flex;gap:6px;overflow-x:auto;padding:6px 0 14px;margin-bottom:16px}',
'.jsv2-tabs button{white-space:nowrap;padding:9px 13px;background:#e8eef2;color:#435971;border:none;border-radius:9px;font-weight:700;cursor:pointer}',
'.jsv2-tabs button.active{background:#132d4a;color:white}',
'.jsv2-main{margin:24px auto 90px;padding:22px;width:min(1120px,95vw);min-height:60vh;background:#fff;border:1px solid #e0e9ed;border-radius:19px;color:#173047}',
'.jsv2-main h1{font-size:25px}.jsv2-main h2{font-size:19px;margin:18px 0 9px}',
'.jsv2-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:12px}',
'.jsv2-stat,.jsv2-card{border:1px solid #dfe7ec;background:#fafdfe;border-radius:13px;padding:16px;margin-bottom:10px}',
'.jsv2-stat span{display:block;font-size:12px;color:#6c8091}.jsv2-stat b{font-size:24px}',
'.jsv2-card p,.jsv2-card small{color:#637c8d;font-size:13px;line-height:1.5}',
'.jsv2-row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}',
'.jsv2-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}',
'.jsv2-actions button,.jsv2-actions a{border:1px solid #c7dedb;background:#eaf8f5;color:#136a5c;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;text-decoration:none;cursor:pointer}',
'.jsv2-table-wrap{max-width:100%;overflow-x:auto}.jsv2-table{width:100%;border-collapse:collapse;min-width:570px;font-size:13px}',
'.jsv2-table th,.jsv2-table td{padding:11px;border-bottom:1px solid #ebf0f2;text-align:left}',
'.jsv2-table th{color:#678092;background:#f5f8fa;font-size:12px}',
'.jsv2-main input,.jsv2-main select,.jsv2-main textarea{width:100%;padding:10px;font-size:15px;color:#19324a;border:1px solid #cbd8df;border-radius:9px;box-sizing:border-box}',
'.jsv2-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}',
'.jsv2-form label{font-size:13px;font-weight:700;color:#486074}',
'.jsv2-form input,.jsv2-form select,.jsv2-form textarea{margin-top:5px}',
'.jsv2-dialog{position:fixed;inset:0;z-index:16001;background:#091a2baf;display:grid;place-items:center;padding:15px}',
'.jsv2-dialog .jsv2-card{width:min(580px,100%);max-height:85vh;overflow-y:auto;background:#fff}',
'.jsv2-chatline{padding:9px;border-radius:9px;background:#f0f5f7;margin:7px 0}',
'.jsv2-chatline.mine{background:#dff5ef;margin-left:14%}',
'.jsv2-error{background:#fff0f0;color:#9a2929;padding:12px;border-radius:10px;margin:12px 0}',
'@media(max-width:550px){.jsv2-main{width:100%;margin:10px auto 110px;border-radius:0;padding:17px}.jsv2-login{padding:23px}}'
].join('\n');
document.head.append(css);
function notice(message){
 let old=$('.jsv2-toast');if(old)old.remove();
 const el=document.createElement('div');el.className='jsv2-toast';
 el.style.cssText='position:fixed;z-index:16002;bottom:18px;left:18px;right:18px;max-width:420px;margin:auto;background:#163451;color:white;padding:15px;border-radius:12px;box-shadow:0 10px 30px #0003';
 el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),4500);
}
function loginForm(error=''){
 let veil=$('#jsv2-backdrop');
 if(!veil){veil=document.createElement('section');veil.className='jsv2-backdrop';veil.id='jsv2-backdrop';document.body.append(veil)}
 veil.innerHTML='<div class="jsv2-login"><div class="eyebrow">JORSENSHOP · V2</div><h1>Accès professionnel</h1>'+
  '<p>Connexion réservée aux collaborateurs disposant d’un rôle autorisé. Vos identifiants restent confidentiels.</p>'+
  (error?'<div class="jsv2-error">'+h(error)+'</div>':'')+
  '<form id="jsv2-login-form"><label>Adresse e-mail<input name="email" type="email" autocomplete="username" required></label>'+
  '<label>Mot de passe<input name="password" type="password" minlength="8" autocomplete="current-password" required></label>'+
  '<button class="jsv2-btn">Se connecter</button></form></div>';
 $('#jsv2-login-form',veil).onsubmit=async e=>{
  e.preventDefault();const v=Object.fromEntries(new FormData(e.target));
  try{
   await api('auth?action=login',{method:'POST',body:JSON.stringify(v)});
   const result=await api('staff');profile=result;
   if((portal==='admin'&&!['admin','gerant'].includes(result.role))||
     (portal==='investisseur'&&!['admin','investisseur'].includes(result.role))||
     (portal==='livreur'&&result.role!=='livreur'))throw Error('Ce compte ne dispose pas des accès pour cet espace.');
   veil.remove();await load();
  }catch(err){loginForm(err.message)}
 };
}
function shell(body){
 const host=$('#app main')||document.querySelector('main');
 if(!host)return;
 let node=$('#jsv2-live',host);
 if(!node){node=document.createElement('section');node.id='jsv2-live';node.className='jsv2-main';host.replaceChildren(node)}
 node.innerHTML=body;
 return node;
}
const button=(action,id,label)=>'<button data-jsv2="'+h(action)+'" data-id="'+h(id||'')+'">'+h(label)+'</button>';
function tabs(entries){
 return '<nav class="jsv2-tabs">'+entries.map(([id,title])=>
  '<button data-tab="'+h(id)+'" class="'+(tab===id?'active':'')+'">'+h(title)+'</button>').join('')+'</nav>';
}
function frame(body,options){
 return '<div class="jsv2-head"><div><small>JORSENSHOP · '+h(profile?.role||'')+'</small><h1>'+
   (portal==='livreur'?'Mes livraisons':portal==='investisseur'?'Rapports financiers':'Gestion de la boutique')+
   '</h1></div><button class="jsv2-btn" data-jsv2="logout">Déconnexion</button></div>'+
   tabs(options)+body;
}
const getState=s=>({
 a_confirmer:'Commande en attente',confirmee:'Commande confirmée',en_preparation:'En préparation',
 en_livraison:'En cours de livraison',livree:'Livrée',annulee:'Annulée'
}[s]||s);
function adminHTML(){
 const orders=data.orders||[],products=data.products||[],categories=data.categories||[];
 const messages='<div class="jsv2-note">Chaque commande possède une conversation privée accessible depuis la rubrique Commandes.</div>';
 const nav=[['accueil','Tableau de bord'],['commandes','Commandes'],['produits','Produits'],['categories','Catégories'],['equipe','Équipe'],['notifications','Notifications']];
 if(tab==='accueil')return frame('<div class="jsv2-grid">'+
  [['Commandes',orders.length],['En attente',orders.filter(o=>o.status==='a_confirmer').length],
   ['En préparation',orders.filter(o=>o.status==='en_preparation').length],
   ['À expédier',orders.filter(o=>o.v2_ready_at&&o.status==='en_preparation').length],
   ['Notifications',unread]].map(([k,v])=>'<div class="jsv2-stat"><span>'+h(k)+'</span><b>'+v+'</b></div>').join('')+
  '</div><h2>Commandes récentes</h2>'+renderOrders(orders.slice(0,6)),nav);
 if(tab==='commandes')return frame('<h2>Gestion des commandes</h2><p class="jsv2-note">Pour Likasi, Fungurume et Kolwezi, confirmer le paiement avant toute préparation et expédition.</p>'+renderOrders(orders),nav);
 if(tab==='categories')return frame('<div class="jsv2-row"><h2>Catégories</h2>'+button('add-category','','+ Nouvelle catégorie')+'</div>'+
  categories.map(c=>'<div class="jsv2-card jsv2-row"><strong>'+h(c.name)+'</strong>'+button('rename-category',c.name,'Renommer')+'</div>').join(''),nav);
 if(tab==='produits')return frame('<h2>Ajouter un produit</h2><form id="jsv2-add-product" class="jsv2-form">'+
  '<label>Nom commercial<input name="name" required placeholder="Ex. Pull quarter-zip"></label>'+
  '<label>Catégorie<select name="category" required>'+categories.map(c=>'<option>'+h(c.name)+'</option>').join('')+'</select></label>'+
  '<label>Prix en FC<input name="priceFc" type="number" min="0" required></label>'+
  '<label>Couleur<input name="color" placeholder="Noir" required></label>'+
  '<label>Tailles (séparées par une virgule)<input name="sizes" placeholder="S,M,L,XL" required></label>'+
  '<label>Stock par taille<input name="stock" type="number" min="0" value="0" required></label>'+
  '<label>Images (Cloudinary)<input name="photos" type="file" accept="image/*" multiple required></label>'+
  '<label>Description<textarea name="description" rows="2"></textarea></label>'+
  '<button class="jsv2-btn" type="submit">Ajouter comme brouillon</button></form>'+
  '<h2>Catalogue ('+products.length+')</h2><div class="jsv2-table-wrap"><table class="jsv2-table"><thead><tr><th>Article</th><th>Catégorie</th><th>Prix</th><th>État</th><th>Action</th></tr></thead><tbody>'+
  products.map(p=>'<tr><td>'+h(p.name)+'</td><td>'+h(p.category)+'</td><td>'+money(p.priceFc)+'</td><td>'+
   (p.is_published?'Visible':'Masqué')+'</td><td>'+button('edit-product',p.id,'Modifier')+' '+button('edit-stock',p.id,'Stock')+' '+button('toggle-publication',p.id,p.is_published?'Masquer':'Publier')+'</td></tr>').join('')+
  '</tbody></table></div>',nav);
 if(tab==='equipe')return frame('<h2>Accès professionnels</h2><p class="jsv2-note">Les employés doivent posséder un compte avant attribution de rôle. Aucun rôle ne peut être attribué par le client lui-même.</p>'+
  '<form id="jsv2-role-form" class="jsv2-form"><label>E-mail collaborateur<input type="email" name="email" required></label>'+
  '<label>Rôle<select name="role"><option value="livreur">Livreur</option>'+
  (profile?.role==='admin'?'<option value="gerant">Gérant</option><option value="investisseur">Investisseur</option><option value="admin">Administrateur</option>':'')+
  '</select></label><button class="jsv2-btn">Autoriser ce compte</button></form>'+
  '<h2>Comptes autorisés</h2>'+((data.roles||[]).map(r=>'<div class="jsv2-card">'+h(r.name||r.email||r.id)+' — '+h(r.role)+'</div>').join('')||'Aucun compte'),nav);
 if(tab==='notifications')return frame('<h2>Dernières notifications</h2>'+
  ((data.notifications||[]).map(n=>'<div class="jsv2-card jsv2-row"><div><b>'+h(n.title)+'</b><small>'+h(n.created_at)+'</small></div>'+
   (n.is_read?'Lu':button('read-notif',n.id,'Marquer lu'))+'</div>').join('')||'<p>Rien de nouveau</p>'),nav);
 return frame(messages,nav);
}
function renderOrders(orders){
 if(!orders.length)return '<div class="jsv2-note">Aucune commande enregistrée.</div>';
 return orders.map(o=>{
  const local=o.delivery_city?.toLowerCase()==='lubumbashi',prepaid=!local;
  const selectable=local?'':'';
  const pay=o.payment_status==='payee';
  return '<article class="jsv2-card"><div class="jsv2-row"><strong>'+h(o.order_number)+'</strong><b>'+money(o.totalFc)+'</b></div>'+
   '<p>'+h(o.customer_name)+' · '+h(o.customer_phone)+'<br>'+h(o.delivery_address)+', '+h(o.delivery_city)+
   '<br>'+getState(o.status)+' · '+h(o.payment_status)+' · '+h(o.v2_delivery_mode||'normal')+'</p>'+
   '<small>'+h((o.items||[]).map(x=>x.name+' ×'+x.qty+' ('+x.size+')').join(' ; '))+'</small>'+
   '<div class="jsv2-actions">'+button('chat',o.order_number,'Conversation')+
     (o.status==='a_confirmer'?button('set-status',o.order_number,'Confirmer'):'')+
     (!pay?button('verify-payment',o.order_number,'Confirmer le paiement'):'')+
     (o.status==='confirmee'&&(!prepaid||pay)?button('prepare',o.order_number,'Préparer'):'')+
     (o.status==='en_preparation'&&!o.v2_ready_at?button('ready',o.order_number,'Colis prêt'):'')+
     (o.status==='en_preparation'&&o.v2_ready_at?
       button(local?'assign':'expedier',o.order_number,local?'Attribuer livreur':'Expédier'): '')+
     (!['livree','annulee'].includes(o.status)?button('cancel',o.order_number,'Annuler'):'')+
   '</div></article>';
 }).join('');
}
function investorHTML(){
 const m=data.monthly||[],e=data.expenses||[];
 const total=m.reduce((s,x)=>s+x.revenueFc,0);
 return frame('<div class="jsv2-note">Lecture seule : uniquement les montants réellement encaissés. Aucune rémunération de 30 % appliquée sans accord signé.</div>'+
 '<div class="jsv2-grid"><div class="jsv2-stat"><span>Ventes encaissées (période)</span><b>'+money(total)+'</b></div>'+
 '<div class="jsv2-stat"><span>Dépenses</span><b>'+money(e.reduce((s,x)=>s+x.amountFc,0))+'</b></div></div>'+
 '<h2>Historique mensuel</h2><div class="jsv2-table-wrap"><table class="jsv2-table"><thead><tr><th>Mois</th><th>Commandes payées</th><th>Ventes</th></tr></thead><tbody>'+
 m.map(x=>'<tr><td>'+h(x.month)+'</td><td>'+x.orders+'</td><td>'+money(x.revenueFc)+'</td></tr>').join('')+'</tbody></table></div>'+
 '<h2>Accords signés</h2>'+((data.agreements||[]).map(a=>'<p>'+h(a.name)+' — '+h(a.percentage)+' %</p>').join('')||'<p>Aucun accord signé enregistré</p>'),
 [['accueil','Synthèse']]);
}
function driverHTML(){
 const rows=data.deliveries||[];
 const todo=rows.filter(x=>x.delivery_status!=='delivered');
 const nav=[['accueil','Missions'],['historique','Historique']];
 const list=(tab==='historique'?rows.filter(x=>x.delivery_status==='delivered'):todo);
 return frame('<div class="jsv2-grid">'+
  [['Attribuées',rows.length],['À réaliser',todo.length],['Livrées',rows.filter(x=>x.delivery_status==='delivered').length],
   ['À encaisser',money(todo.filter(x=>x.payment_status!=='payee').reduce((s,x)=>s+x.totalFc,0))]].map(([a,b])=>
   '<div class="jsv2-stat"><span>'+h(a)+'</span><b>'+h(b)+'</b></div>').join('')+
  '</div><h2>Mes livraisons</h2>'+
  (list.map(x=>'<article class="jsv2-card"><div class="jsv2-row"><strong>'+h(x.order_number)+'</strong><b>'+money(x.totalFc)+'</b></div>'+
   '<p><b>Client :</b> '+h(x.customer_name)+'<br><b>Adresse :</b> '+h(x.delivery_address)+', '+h(x.delivery_city)+
   '<br><b>Téléphone :</b> '+h(x.customer_phone)+'<br><b>Statut :</b> '+h(x.delivery_status)+
   '<br><b>Encaissement :</b> '+h(x.payment_status)+'</p>'+
   '<small>'+h((x.items||[]).map(i=>i.name+' x'+i.qty+' · '+i.size).join(', '))+'</small>'+
   (x.delivery_notes?'<p><b>Instructions :</b> '+h(x.delivery_notes)+'</p>':'')+
   '<div class="jsv2-actions"><a href="tel:'+h(String(x.customer_phone).replace(/[^+0-9]/g,''))+'">Appeler</a>'+
   '<a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(x.delivery_address+', '+x.delivery_city)+'" target="_blank" rel="noopener noreferrer">Itinéraire</a>'+
   (x.delivery_status==='assigned'?button('picked_up',x.order_id,'Colis récupéré'):'')+
   (x.delivery_status==='picked_up'?button('delivered',x.order_id,'Livraison effectuée')+button('failed',x.order_id,'Signaler un problème'):'')+
   '</div></article>').join('')||'<div class="jsv2-note">Aucune mission dans cette rubrique.</div>'),nav);
}
function render(){
 const main=shell(portal==='admin'?adminHTML():portal==='investisseur'?investorHTML():driverHTML());
 if(main){main.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>{tab=x.dataset.tab;render()});}
}
async function load(){
 if(!profile)return;
 if(portal==='admin'){
  const [orders,cat,notif,roles]=await Promise.all([
   api('admin/orders'),api('admin/catalogue'),api('notifications'),api('admin/roles')
  ]);
  data={...orders,...cat,...roles,notifications:notif.notifications};
  unread=notif.unread;
 }else if(portal==='investisseur')data=await api('investor');
 else data=await api('driver');
 loaded=true;render();
}
async function chat(number){
 if(popup)popup.remove();
 const div=document.createElement('div');popup=div;div.className='jsv2-dialog';
 div.innerHTML='<section class="jsv2-card"><button class="jsv2-btn" id="jsv2-close">Fermer</button><h2>'+h(number)+'</h2>'+
  '<div id="jsv2-messages" style="height:320px;overflow:auto;padding:12px;background:#f6f9fa;border-radius:10px"></div>'+
  '<form id="jsv2-send" class="jsv2-row"><input name="message" maxlength="2000" placeholder="Répondre au client" required>'+
  '<button class="jsv2-btn">Envoyer</button></form></section>';
 document.body.append(div);
 $('#jsv2-close',div).onclick=()=>{div.remove();popup=null};
 async function refresh(){
  try{const r=await api('chat?orderNumber='+encodeURIComponent(number));
   $('#jsv2-messages',div).innerHTML=(r.messages||[]).map(x=>
    '<div class="jsv2-chatline'+(x.isMine?' mine':'')+'">'+h(x.message)+'</div>').join('');
  }catch(err){notice(err.message)}
 }
 $('#jsv2-send',div).onsubmit=async e=>{
  e.preventDefault();const message=new FormData(e.target).get('message');
  try{await api('chat',{method:'POST',body:JSON.stringify({orderNumber:number,message})});
   e.target.reset();await refresh()}catch(err){notice(err.message)}
 };
 refresh();
}
async function uploadImage(file){
 const sign=await api('admin/media-sign',{method:'POST',body:'{}'});
 const fd=new FormData();
 fd.append('file',file);fd.append('api_key',sign.apiKey);fd.append('timestamp',sign.timestamp);
 fd.append('public_id',sign.publicId);fd.append('overwrite',sign.overwrite);fd.append('signature',sign.signature);
 const r=await fetch(sign.uploadUrl,{method:'POST',body:fd});
 const o=await r.json();
 if(!r.ok||!o.secure_url)throw Error(o.error?.message||'Échec Cloudinary');
 return o.secure_url;
}
document.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-jsv2]');if(!btn||!profile)return;
 const a=btn.dataset.jsv2,id=btn.dataset.id;
 try{
  if(a==='logout'){await api('auth?action=logout',{method:'POST',body:'{}'});profile=null;loginForm();return}
  if(a==='chat')return chat(id);
  if(a==='add-category'){
   const name=prompt('Nom de la nouvelle catégorie');if(!name)return;
   await api('admin/catalogue',{method:'POST',body:JSON.stringify({action:'create-category',name})});
  }else if(a==='rename-category'){
   const name=prompt('Nouveau nom pour '+id,id);if(!name||name===id)return;
   await api('admin/catalogue',{method:'POST',body:JSON.stringify({action:'rename-category',oldName:id,name})});
  }else if(a==='edit-product'){
   const p=(data.products||[]).find(p=>p.id===id);if(!p)return;
   const name=prompt('Nom courant du produit',p.name);if(!name)return;
   const category=prompt('Catégorie',p.category);if(!category)return;
   const priceFc=Number(prompt('Prix FC',p.priceFc));if(!Number.isSafeInteger(priceFc))return;
   const description=prompt('Description',p.description||'');if(description===null)return;
   await api('admin/catalogue',{method:'POST',body:JSON.stringify({
    action:'update-metadata',id,name,category,priceFc,description
   })});
  }else if(a==='edit-stock'){
   const p=(data.products||[]).find(p=>p.id===id);if(!p)return;
   const variants=(p.variants||[]);
   if(!variants.length)throw Error('Ce produit ne possède aucune variante');
   const selection=prompt('Variante à modifier :\n'+variants.map((v,i)=>(i+1)+'. '+v.color).join('\n'),'1');
   if(selection===null)return;
   const variant=variants[Number(selection)-1];
   if(!variant)throw Error('Choisissez un numéro de variante valide');
   const sizes=Array.isArray(p.sizes)?p.sizes:[],
    chosen=prompt('Taille : '+sizes.join(', '),sizes[0]||'M');
   if(chosen===null)return;
   const current=variant.stock?.[chosen]||0;
   const input=prompt('Stock disponible ('+chosen+')',String(current));
   if(input===null)return;
   const quantity=Number(input);
   if(!Number.isSafeInteger(quantity)||quantity<0||quantity>100000)
    throw Error('La quantité doit être un entier positif');
   await api('admin/catalogue',{method:'POST',body:JSON.stringify({
    action:'set-stock',id,variantId:variant.id,size:chosen,quantity
   })});
  }else if(a==='toggle-publication'){
   const p=(data.products||[]).find(p=>p.id===id);if(!p)return;
   await api('admin/catalogue',{method:'POST',body:JSON.stringify({
     action:'set-publication',id,publish:!p.is_published
   })});
  }else if(a==='set-status'||a==='prepare'||a==='cancel'){
   const status=a==='set-status'?'confirmee':a==='prepare'?'en_preparation':'annulee';
   if(!confirm('Changer le statut en '+status+' ?'))return;
   await api('admin/orders',{method:'POST',body:JSON.stringify({action:'set-status',orderNumber:id,status})});
  }else if(a==='ready'){
   await api('admin/orders',{method:'POST',body:JSON.stringify({action:'ready',orderNumber:id})});
  }else if(a==='verify-payment'){
   const provider=prompt('Moyen de paiement : airtel_money, orange_money, cash ou other');
   if(!provider)return;
   const reference=prompt('Référence ou justification du paiement vérifié')||'';
   if(!confirm('Avez-vous personnellement vérifié le montant intégral reçu ?'))return;
   await api('admin/orders',{method:'POST',body:JSON.stringify({action:'verify-payment',orderNumber:id,provider,reference})});
  }else if(a==='assign'){
   const drivers=(await api('admin/drivers')).drivers||[];
   if(!drivers.length)throw Error('Créez et autorisez un livreur avant attribution');
   const picked=prompt('Identifiant du livreur :\n'+drivers.map(d=>d.name+' : '+d.id).join('\n'),drivers[0].id);
   if(!picked)return;
   await api('admin/orders',{method:'POST',body:JSON.stringify({action:'assign-driver',orderNumber:id,courierId:picked})});
  }else if(a==='expedier'){
   const agency=prompt('Agence d’expédition : KKS ou NGOKAF','KKS');if(!agency)return;
   const tracking=prompt('Référence du colis / bordereau')||'';
   await api('admin/orders',{method:'POST',body:JSON.stringify({action:'expedition',orderNumber:id,agency,tracking})});
  }else if(a==='read-notif'){
   await api('notifications',{method:'POST',body:JSON.stringify({id})});
  }else if(['picked_up','delivered','failed'].includes(a)){
   const cashCollectedFc=a==='delivered'?Number(prompt('Montant réellement encaissé (FC)','0')):0;
   const reason=a==='failed'?prompt('Raison de la livraison non effectuée'):'';
   if(!Number.isSafeInteger(cashCollectedFc)||cashCollectedFc<0||reason===null)return;
   await api('driver',{method:'POST',body:JSON.stringify({action:a,orderId:id,cashCollectedFc,reason})});
  }else return;
  notice('Opération enregistrée');await load();
 }catch(err){notice(err.message)}
});
document.addEventListener('submit',async e=>{
 if(!profile)return;
 if(e.target.id==='jsv2-role-form'){
  e.preventDefault();const b=Object.fromEntries(new FormData(e.target));
  try{await api('admin/roles',{method:'POST',body:JSON.stringify(b)});notice('Compte autorisé');await load()}
  catch(err){notice(err.message)}
 }
 if(e.target.id==='jsv2-add-product'){
  e.preventDefault();const f=e.target,values=Object.fromEntries(new FormData(f));
  const files=f.querySelector('[name="photos"]').files;
  if(!files?.length)return notice('Ajoutez au moins une photo');
  try{
   notice('Envoi des photos vers Cloudinary…');
   const images=[];for(const file of Array.from(files).slice(0,8))images.push(await uploadImage(file));
   const sizes=String(values.sizes||'').split(',').map(s=>s.trim()).filter(Boolean);
   const stock=Object.fromEntries(sizes.map(s=>[s,Math.max(0,Number(values.stock)||0)]));
   await api('admin/catalogue',{method:'POST',body:JSON.stringify({
    action:'save-product',name:values.name,category:values.category,
    priceFc:Number(values.priceFc),description:values.description,sizes,
    variants:[{color:values.color,images,stock}],isPublished:false,pricesConfirmed:false
   })});
   notice('Produit ajouté. Vous pouvez modifier son prix et son stock à tout moment.');
   f.reset();await load();
  }catch(err){notice(err.message)}
 }
});
async function init(){
 loginForm();
 try{
  const s=await api('staff');
  if((portal==='admin'&&['admin','gerant'].includes(s.role))||
     (portal==='investisseur'&&['investisseur','admin'].includes(s.role))||
     (portal==='livreur'&&s.role==='livreur')){
    profile=s;$('#jsv2-backdrop')?.remove();await load();
  }
 }catch{}
}
const mo=new MutationObserver(()=>{
 if(!profile||!loaded)return;
 const main=$('#app main')||document.querySelector('main');
 if(main&&!$('#jsv2-live',main))render();
});
function start(){
 mo.observe(document.body,{childList:true,subtree:true});init();
 setInterval(async()=>{if(document.hidden||!profile||portal!=='admin')return;
  try{const n=await api('notifications');if(n.unread>unread)notice('Vous avez de nouvelles notifications JorsenShop');
  unread=n.unread;if(tab==='notifications')await load()}catch{}
 },30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();