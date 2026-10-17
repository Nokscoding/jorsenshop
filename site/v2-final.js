/* JorsenShop — parcours client réel V2. Browsing: city required. Checkout: account required. */
(() => {
'use strict';
if(window.JORSEN_PORTAL && window.JORSEN_PORTAL!=='public')return;
const $=(sel,root=document)=>root.querySelector(sel);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fc=x=>new Intl.NumberFormat('fr-FR').format(Number(x)||0)+' FC';
const STORAGE_CITY='jorsenshop_v2_city';
const REQUEST_KEY='jorsenshop_v2_pending_order_id';
const LABELS={a_confirmer:'Commande en attente',en_attente:'En attente',
 confirmee:'Commande confirmée',en_preparation:'En préparation',
 prete_a_livrer:'Prête à livrer',en_livraison:'En cours de livraison',
 expediee:'Colis expédié',livree:'Livrée',annulee:'Annulée',echec_livraison:'Livraison non effectuée',
 payee:'Payée',en_attente_paiement:'Paiement en attente'};
const label=x=>LABELS[x]||String(x||'En attente').replaceAll('_',' ');
const state={city:localStorage.getItem(STORAGE_CITY)||'',cities:[],user:null,profile:null,
 orders:[],notifications:[],unread:0,loading:false,ready:false,busy:false,authError:'',
 orderError:'',openChat:null,chatTimer:null,noticeCount:-1,paymentMode:'normal'};
const send=async(url,opts={})=>{
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json'},...opts});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||'Service momentanément indisponible');
 return result;
};
const toast=(message,error=false)=>{
 const old=$('#j2-toast');if(old)old.remove();
 const box=document.createElement('div');box.id='j2-toast';box.className='j2-toast'+(error?' error':'');
 box.textContent=message;document.body.append(box);setTimeout(()=>box.remove(),4500);
};
const cityInfo=()=>state.cities.find(c=>c.id===state.city);
const chooseCityName=()=>cityInfo()?.name||'Choisir une ville';
function go(route){location.hash='#/'+route.replace(/^#?\/?/,'');renderNow();}
function renderNow(){if(typeof window.JORSEN_V2_RENDER==='function')window.JORSEN_V2_RENDER();}
const cart=()=>typeof window.JORSEN_CART_ITEMS==='function'?window.JORSEN_CART_ITEMS():[];
const catalog=()=>Array.isArray(window.JORSEN_CATALOG)?window.JORSEN_CATALOG:[];
const cartLines=()=>{
 return cart().map(row=>{
  const p=catalog().find(p=>p.id===row.id),variant=p?.variants?.[row.variant];
  return p&&variant?{p,variant,size:row.size,quantity:Number(row.qty),
    price:Number(p.price),subtotal:Number(p.price)*Number(row.qty)}:null;
 }).filter(Boolean);
};
function root(title,subtitle,body){
 return '<main class="j2-page"><div class="j2-container">'+
 '<div class="j2-pagehead"><div><div class="j2-eyebrow">JORSENSHOP</div><h1>'+esc(title)+'</h1>'+
 (subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div>'+
 '<button class="j2-city-pill" type="button" data-j2="city" aria-label="Changer de ville">'+
 '<span class="j2-pin">⌖</span> '+esc(chooseCityName())+'</button></div>'+body+
 '</div></main>';
}
function authWelcome(){
 return '<section class="j2-login-welcome"><div class="j2-hero-mark">J</div>'+
 '<div><div class="j2-eyebrow">VOTRE ESPACE PERSONNEL</div>'+
 '<h2>Un compte pour simplifier vos achats.</h2>'+
 '<p>Explorez librement la boutique. Vous aurez besoin d’un compte uniquement pour passer commande, suivre vos colis et échanger avec le gérant.</p>'+
 '<div class="j2-btn-row"><button class="j2-primary" data-j2="register">Créer mon compte</button>'+
 '<button class="j2-secondary" data-j2="login">Se connecter</button></div></div></section>'+
 '<div class="j2-perks"><span>✓ Inscription rapide</span><span>✓ Aucun e-mail de confirmation</span>'+
 '<span>✓ Suivi des commandes</span></div>';
}
function loginForm(kind){
 const signup=kind==='inscription';
 return '<section class="j2-auth-layout"><div class="j2-auth-panel">'+
 '<div class="j2-eyebrow">'+(signup?'NOUVEAU SUR JORSENSHOP':'HEUREUX DE VOUS REVOIR')+'</div>'+
 '<h2>'+(signup?'Créer un compte':'Connexion')+'</h2>'+
 '<p>'+(signup?'Quelques secondes suffisent, sans confirmation par e-mail.':'Retrouvez votre panier, vos commandes et vos messages.')+'</p>'+
 '<form data-j2-form="auth" data-kind="'+(signup?'signup':'login')+'">'+
 (signup?'<label>Nom complet<input name="name" required minlength="2" maxlength="100" autocomplete="name" placeholder="Votre nom et prénom"></label>':'')+
 '<label>Adresse e-mail<input type="email" name="email" required autocomplete="email" placeholder="exemple@email.com"></label>'+
 '<label>Mot de passe<input type="password" name="password" required minlength="8" maxlength="128" autocomplete="'+
 (signup?'new-password':'current-password')+'" placeholder="8 caractères minimum"></label>'+
 (state.authError?'<p class="j2-error" role="alert">'+esc(state.authError)+'</p>':'')+
 '<button class="j2-primary j2-full" type="submit" '+(state.busy?'disabled':'')+'>'+
 (state.busy?'Veuillez patienter…':signup?'Créer mon compte':'Se connecter')+'</button></form>'+
 '<p class="j2-auth-bottom">'+(signup?'Déjà inscrit ?':'Pas encore de compte ?')+
 ' <button class="j2-link" data-j2="'+(signup?'login':'register')+'">'+
 (signup?'Se connecter':'Créer un compte')+'</button></p>'+
 '<a class="j2-back-link" href="#/catalogue">← Retour à la boutique</a></div>'+
 '<aside class="j2-auth-side"><div class="j2-eyebrow">ACHETEZ EN CONFIANCE</div>'+
 '<h3>Votre style, à votre rythme.</h3><p>Vos articles favoris, votre historique et toutes vos conversations dans un seul espace.</p>'+
 '</aside></section>';
}
const accountTabs=active=>{
 const tabs=[['accueil','Vue d’ensemble'],['commandes','Mes commandes'],['favoris','Favoris'],
 ['messages','Messages'],['notifications','Notifications'+(state.unread?' ('+state.unread+')':'')],
 ['profil','Mon profil']];
 return '<nav class="j2-tabs" aria-label="Mon compte">'+tabs.map(([k,title])=>
 '<a href="#/compte/'+k+'" class="'+(active===k?'active':'')+'">'+esc(title)+'</a>').join('')+'</nav>';
};
function orderCard(order,fromMessages=false){
 const completed=order.status==='livree',canceled=order.status==='annulee';
 return '<article class="j2-order"><div class="j2-order-top"><div><strong>'+esc(order.order_number)+'</strong>'+
 '<small>'+esc(new Date(order.created_at).toLocaleDateString('fr-FR'))+'</small></div>'+
 '<span class="j2-badge '+(completed?'done':canceled?'cancel':'')+'">'+esc(label(order.status))+'</span></div>'+
 '<div class="j2-order-bottom"><div><strong>'+fc(order.totalFc)+'</strong>'+
 '<small>'+esc(order.delivery_city)+' · '+esc(label(order.payment_status))+'</small>'+
 (order.v2_shipping_agency?'<small>Agence : '+esc(order.v2_shipping_agency)+'</small>':'')+
 (order.v2_tracking_number?'<small>Suivi : '+esc(order.v2_tracking_number)+'</small>':'')+
 '</div><button class="j2-outline" data-j2="chat" data-order="'+esc(order.order_number)+'">'+
 (fromMessages?'Ouvrir la conversation':'Suivre et discuter')+'</button></div></article>';
}
function accountMarkup(tab='accueil'){
 tab=tab||'accueil';
 if(!state.ready)return root('Mon compte','', '<section class="j2-card j2-loading">Chargement de votre espace…</section>');
 if(!state.user){
  if(tab==='connexion'||tab==='inscription')return root('Mon compte','Un espace dédié à vos achats',loginForm(tab));
  return root('Mon compte','Votre boutique, vos achats, vos envies',authWelcome());
 }
 const first=String(state.profile?.full_name||state.user.name||'').trim();
 const name=first&&first!=='Client JorsenShop'?first:'Bienvenue';
 const top=accountTabs(tab);
 if(tab==='commandes')return root('Mes commandes','Suivez toutes vos commandes en temps réel',top+
  (state.orders.length?state.orders.map(o=>orderCard(o)).join(''):
   '<div class="j2-empty"><h2>Pas encore de commande</h2><p>Vos achats apparaîtront ici dès votre première commande.</p>'+
   '<a class="j2-primary" href="#/catalogue">Découvrir les articles</a></div>'));
 if(tab==='messages')return root('Messages','Vos échanges privés avec la boutique',top+
  (state.orders.length?'<div class="j2-card"><h2>Vos conversations</h2><p>Choisissez une commande pour échanger directement avec le gérant.</p>'+
  state.orders.map(o=>orderCard(o,true)).join('')+'</div>':
  '<div class="j2-empty"><h2>Aucune conversation</h2><p>Une conversation est ouverte pour chaque commande.</p></div>'));
 if(tab==='notifications')return root('Notifications','Les nouvelles de vos commandes',top+
  '<div class="j2-card"><div class="j2-title-row"><h2>Activité récente</h2>'+
   (typeof Notification!=='undefined'&&Notification.permission!=='denied'?
    '<button class="j2-outline" data-j2="allow-notifications">Activer les alertes</button>':'')+'</div>'+
   (state.notifications.length?state.notifications.map(n=>'<div class="j2-notification '+(n.is_read?'':'unread')+'"><div>'+
     '<strong>'+esc(n.title)+'</strong><small>'+esc(new Date(n.created_at).toLocaleString('fr-FR'))+'</small></div>'+
     (!n.is_read?'<button class="j2-link" data-j2="read" data-id="'+esc(n.id)+'">Marquer comme lu</button>':'')+
     '</div>').join(''):'<p class="j2-emptytext">Aucune notification pour le moment.</p>')+'</div>');
 if(tab==='profil')return root('Mon profil','Vos informations personnelles',top+
  '<section class="j2-card"><h2>Mes coordonnées</h2><form data-j2-form="profile" class="j2-form">'+
  '<label>Nom complet<input name="name" maxlength="100" required value="'+esc(state.profile?.full_name||state.user.name||'')+'"></label>'+
  '<label>Adresse e-mail<input value="'+esc(state.user.email)+'" disabled type="email"></label>'+
  '<label>Téléphone<input name="phone" type="tel" maxlength="32" value="'+esc(state.profile?.phone||'')+'" placeholder="+243…"></label>'+
  '<label>Adresse de livraison<input name="address" maxlength="350" value="'+esc(state.profile?.address||'')+'" placeholder="Quartier, avenue, numéro…"></label>'+
  '<div class="j2-note">Ville : <b>'+esc(chooseCityName())+'</b> <button class="j2-link" type="button" data-j2="city">Changer</button></div>'+
  '<button class="j2-primary" type="submit">Enregistrer</button></form>'+
  '<div class="j2-title-row"><p>Vous souhaitez quitter votre compte ?</p><button class="j2-secondary" data-j2="logout">Se déconnecter</button></div></section>');
 if(tab==='favoris'){
  const fav=typeof window.JORSEN_V2_FAVORITES==='function'?window.JORSEN_V2_FAVORITES():[];
  return root('Mes favoris','Les articles que vous aimez',top+(fav.length?
   '<div class="j2-favorites">'+fav.map(p=>'<a class="j2-favorite" href="#/produit/'+esc(p.id)+'">'+
    '<img loading="lazy" src="'+esc(p.variants?.[0]?.images?.[0]||'')+'" alt="'+esc(p.name)+'">'+
    '<strong>'+esc(p.name)+'</strong><span>'+fc(p.price)+'</span></a>').join('')+'</div>':
   '<div class="j2-empty"><h2>Votre sélection vous attend</h2><p>Retrouvez ici les articles ajoutés à vos favoris.</p>'+
   '<a href="#/catalogue" class="j2-primary">Parcourir la boutique</a></div>'));
 }
 const activeOrders=state.orders.filter(o=>!['livree','annulee'].includes(o.status)).length;
 return root('Mon espace','Votre espace personnel JorsenShop',top+
 '<section class="j2-account-hero"><div><div class="j2-eyebrow">BONJOUR</div><h2>'+esc(name)+'</h2>'+
 '<p>Retrouvez vos commandes, vos articles favoris et vos conversations au même endroit.</p>'+
 '<a class="j2-hero-cta" href="#/catalogue">Explorer la boutique →</a></div>'+
 '<div class="j2-hero-symbol">J</div></section>'+
 '<div class="j2-stats">'+[
  ['Commandes',state.orders.length,'commandes'],
  ['En cours',activeOrders,'commandes'],
  ['Notifications',state.unread,'notifications'],
  ['Favoris',typeof window.JORSEN_V2_FAVORITES==='function'?window.JORSEN_V2_FAVORITES().length:0,'favoris']
 ].map(([name,count,target])=>'<a class="j2-stat" href="#/compte/'+target+'"><span>'+esc(name)+'</span>'+
  '<b>'+count+'</b></a>').join('')+'</div>'+
 '<div class="j2-title-row"><h2>Mes dernières commandes</h2><a href="#/compte/commandes">Tout voir →</a></div>'+
 (state.orders.length?state.orders.slice(0,3).map(o=>orderCard(o)).join(''):
  '<div class="j2-empty"><p>Vous n’avez pas encore passé de commande.</p>'+
  '<a class="j2-outline" href="#/catalogue">Découvrir nos articles</a></div>'));
}
function checkoutMarkup(){
 const lines=cartLines();
 if(!lines.length)return root('Mon panier','Finaliser ma commande',
  '<div class="j2-empty"><h2>Votre panier est vide</h2><p>Ajoutez des articles pour poursuivre.</p>'+
  '<a href="#/catalogue" class="j2-primary">Découvrir la boutique</a></div>');
 if(!state.ready)return root('Finaliser ma commande','', '<div class="j2-card">Préparation du paiement…</div>');
 if(!state.user)return root('Finaliser ma commande','Connexion nécessaire pour commander',
  '<section class="j2-checkout-gate"><div class="j2-lock">J</div><h2>Encore une étape avant de commander</h2>'+
  '<p>Votre panier est conservé. Créez un compte ou connectez-vous pour confirmer votre commande et discuter avec la boutique.</p>'+
  '<div class="j2-btn-row"><button class="j2-primary" data-j2="register">Créer mon compte</button>'+
  '<button class="j2-secondary" data-j2="login">Se connecter</button></div></section>'+
  '<div class="j2-card"><h3>Votre sélection</h3>'+lines.map(x=>'<div class="j2-mini-line">'+
    '<span>'+esc(x.p.name)+' · '+esc(x.size)+' ×'+x.quantity+'</span><strong>'+fc(x.subtotal)+'</strong></div>').join('')+'</div>');
 const quote=cityInfo(),options=quote?.deliveryOptions||[];
 if(!options.some(x=>x.id===state.paymentMode))state.paymentMode=options[0]?.id||'normal';
 const shipping=options.find(x=>x.id===state.paymentMode)?.feeFc||0;
 const total=lines.reduce((sum,x)=>sum+x.subtotal,0);
 const form='<section class="j2-card"><h2>Coordonnées de livraison</h2>'+
 '<p>Votre commande sera livrée à '+esc(chooseCityName())+'.</p>'+
 '<form data-j2-form="checkout" class="j2-form">'+
 '<label>Nom du destinataire<input name="name" required minlength="2" maxlength="100" autocomplete="name" value="'+
 esc(state.profile?.full_name||state.user.name||'')+'"></label>'+
 '<label>Téléphone de contact<input type="tel" name="phone" required minlength="7" maxlength="32" autocomplete="tel" value="'+esc(state.profile?.phone||'')+'"></label>'+
 '<label>Adresse complète<input name="address" required minlength="8" maxlength="350" autocomplete="street-address" placeholder="Commune, quartier, avenue, numéro…" value="'+esc(state.profile?.address||'')+'"></label>'+
 '<label>Instructions de livraison (facultatif)<textarea name="notes" rows="2" maxlength="600" placeholder="Point de repère, indications…"></textarea></label>'+
 '<label>Mode de livraison<select name="mode" id="j2-delivery-mode">'+options.map(opt=>
 '<option value="'+esc(opt.id)+'" '+(opt.id===state.paymentMode?'selected':'')+'>'+
 (opt.id==='normal'?'Normale':opt.id==='express'?'Express':'Expédition via agence')+
 ' — '+fc(opt.feeFc)+'</option>').join('')+'</select></label>'+
 (quote?.mode==='expedition'?'<label>Mode de paiement<select name="paymentProvider" required>'+
 '<option value="">Choisir un moyen</option><option value="airtel_money">Airtel Money</option>'+
 '<option value="orange_money">Orange Money</option></select></label>'+
 '<div class="j2-note">Pour Likasi, Fungurume et Kolwezi : paiement Mobile Money vérifié par le gérant avant la préparation et l’expédition.</div>':
 '<div class="j2-note">Paiement à la livraison à Lubumbashi.</div>')+
 (state.orderError?'<div class="j2-error" role="alert">'+esc(state.orderError)+'</div>':'')+
 '<button class="j2-primary j2-full" type="submit" '+(state.busy?'disabled':'')+'>'+
 (state.busy?'Enregistrement…':'Confirmer ma commande — '+fc(total+shipping))+'</button>'+
 '</form></section>';
 const summary='<aside class="j2-card j2-recap"><h2>Récapitulatif</h2>'+
 lines.map(x=>'<div class="j2-cart-line"><img src="'+esc(x.variant.images?.[0]||'')+'" alt="'+esc(x.p.name)+'" loading="lazy">'+
 '<div><strong>'+esc(x.p.name)+'</strong><small>'+esc(x.variant.color)+' · '+esc(x.size)+' · ×'+x.quantity+
 '</small></div><span>'+fc(x.subtotal)+'</span></div>').join('')+
 '<div class="j2-mini-line"><span>Sous-total</span><strong>'+fc(total)+'</strong></div>'+
 '<div class="j2-mini-line"><span>Livraison</span><strong>'+fc(shipping)+'</strong></div>'+
 '<div class="j2-grand-total"><strong>Total</strong><b>'+fc(total+shipping)+'</b></div></aside>';
 return root('Finaliser ma commande','Vérifiez vos coordonnées et votre panier avant de confirmer.',
  '<div class="j2-checkout-layout">'+form+summary+'</div>');
}

function cityModal(){
 let el=$('#j2-city-modal');
 if(!el){el=document.createElement('div');el.id='j2-city-modal';el.className='j2-city-modal';document.body.append(el);}
 const selected=state.city&&state.cities.some(c=>c.id===state.city);
 el.innerHTML='<section class="j2-city-dialog" role="dialog" aria-modal="true" aria-labelledby="j2-city-title">'+
 '<div class="j2-city-brand">Jorsen<span>shop</span></div><div class="j2-eyebrow">BIENVENUE SUR JORSENSHOP</div>'+
 '<h2 id="j2-city-title">Où souhaitez-vous être livré ?</h2>'+
 '<p>Choisissez votre ville pour découvrir les produits et les frais de livraison.</p>'+
 '<div class="j2-cities">'+state.cities.map(c=>'<button class="j2-city-option '+(state.city===c.id?'selected':'')+
 '" data-j2="select-city" data-city="'+esc(c.id)+'"><strong>'+esc(c.name)+'</strong>'+
 '<small>'+(c.mode==='local'?'Livraison à domicile':'Expédition par agence')+'</small></button>').join('')+'</div>'+
 '<button class="j2-primary j2-full" data-j2="city-continue" '+(selected?'':'disabled')+'>Accéder à la boutique</button></section>';
}
async function updateProfile(updates={}){
 if(!state.user)return;
 const values={city:state.city,name:state.profile?.full_name||state.user.name||'',
  phone:state.profile?.phone||'',address:state.profile?.address||'',...updates};
 await send('/api/v2/me',{method:'POST',body:JSON.stringify(values)});
 state.profile={...state.profile,full_name:values.name,city_code:values.city,phone:values.phone,address:values.address};
}
function closeCity(){
 $('#j2-city-modal')?.remove();
 if(state.user)updateProfile().catch(()=>{});
 renderNow();
}
async function refreshNotifications(showAlert=false){
 if(!state.user)return;
 try{
  const x=await send('/api/v2/notifications');
  const previous=state.unread;
  state.notifications=Array.isArray(x.notifications)?x.notifications:[];
  state.unread=Number(x.unread)||0;
  if(showAlert&&state.unread>previous){
   toast('Vous avez une nouvelle notification JorsenShop.');
   if(typeof Notification!=='undefined'&&Notification.permission==='granted'&&!document.hidden)
    new Notification('JorsenShop',{body:'Une nouvelle activité sur votre commande'});
  }
  if(location.hash.includes('/compte'))renderNow();
 }catch{}
}
async function refreshOrders(shouldRender=true){
 if(!state.user)return;
 try{
  const [orders,me]=await Promise.all([send('/api/v2/orders'),send('/api/v2/me')]);
  state.orders=Array.isArray(orders.orders)?orders.orders:[];
  state.profile=me.profile||state.profile;
  if(shouldRender&&location.hash.includes('compte'))renderNow();
 }catch(e){toast('Historique momentanément indisponible.',true);}
}
async function loadCatalogue(){
 try{
  const r=await send('/api/products');
  if(typeof window.JORSEN_SET_LIVE_CATALOGUE==='function')
   window.JORSEN_SET_LIVE_CATALOGUE(Array.isArray(r.products)?r.products:[]);
 }catch(e){
  if(typeof window.JORSEN_SET_LIVE_CATALOGUE==='function')window.JORSEN_SET_LIVE_CATALOGUE([]);
  toast('Catalogue momentanément indisponible.',true);
 }
}
async function init(){
 try{
  const r=await send('/api/v2/cities');state.cities=r.cities||[];
  if(!state.cities.length)throw Error('Aucune ville disponible');
  try{
   const session=await send('/api/v2/auth?action=session');
   state.user=session.authenticated?session.user:null;
  }catch{state.user=null}
  state.ready=true;
  if(state.user)await Promise.allSettled([refreshOrders(false),refreshNotifications(false)]);
  await loadCatalogue();renderNow();
  if(!state.cities.some(c=>c.id===state.city)){
   state.city='';localStorage.removeItem(STORAGE_CITY);cityModal();
  }
 }catch(e){state.ready=true;renderNow();toast('Impossible de charger JorsenShop. Actualisez la page.',true);}
}
function closeChat(){
 state.openChat=null;clearInterval(state.chatTimer);state.chatTimer=null;$('#j2-chat-modal')?.remove();
}
function openChat(number){
 if(!state.user){go('compte/connexion');return}
 if(!state.orders.some(o=>o.order_number===number)){toast('Commande introuvable.',true);return}
 closeChat();state.openChat=number;
 const box=document.createElement('div');box.id='j2-chat-modal';box.className='j2-chat-modal';
 box.innerHTML='<section class="j2-chat-dialog" role="dialog" aria-modal="true" aria-label="Conversation sur la commande">'+
 '<div class="j2-title-row"><div><div class="j2-eyebrow">CONVERSATION PRIVÉE</div><h2>'+esc(number)+'</h2></div>'+
 '<button class="j2-chat-close" data-j2="close-chat" aria-label="Fermer la conversation">×</button></div>'+
 '<div class="j2-chat-feed" id="j2-chat-feed"><p>Chargement des messages…</p></div>'+
 '<form data-j2-form="chat" class="j2-chat-compose"><input name="message" maxlength="2000" required placeholder="Votre message au gérant">'+
 '<button class="j2-primary" type="submit">Envoyer</button></form></section>';
 document.body.append(box);
 const refresh=async()=>{
  if(state.openChat!==number)return;
  try{
   const r=await send('/api/v2/chat?orderNumber='+encodeURIComponent(number));
   const el=$('#j2-chat-feed',box);if(!el)return;
   el.innerHTML=(r.messages||[]).length?r.messages.map(m=>
    '<div class="j2-chat-bubble '+(m.isMine?'mine':'theirs')+'"><p>'+esc(m.message)+'</p>'+
    '<small>'+esc(new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}))+'</small></div>').join(''):
    '<p class="j2-chat-empty">La conversation est ouverte. Envoyez votre premier message.</p>';
   el.scrollTop=el.scrollHeight;
  }catch(e){const el=$('#j2-chat-feed',box);if(el)el.textContent=e.message;}
 };
 refresh();state.chatTimer=setInterval(refresh,9000);
}
async function handleAuth(form){
 if(state.busy)return;
 const fd=new FormData(form),kind=form.dataset.kind;
 const payload={email:String(fd.get('email')||'').trim(),password:String(fd.get('password')||'')};
 if(kind==='signup')payload.name=String(fd.get('name')||'').trim();
 state.busy=true;state.authError='';
 try{
  await send('/api/v2/auth?action='+kind,{method:'POST',body:JSON.stringify(payload)});
  let session=await send('/api/v2/auth?action=session');
  if(!session.authenticated&&kind==='signup'){
   await send('/api/v2/auth?action=login',{method:'POST',body:JSON.stringify(payload)});
   session=await send('/api/v2/auth?action=session');
  }
  if(!session.authenticated)throw Error('Connexion non confirmée. Réessayez.');
  state.user=session.user;
  if(kind==='signup')await updateProfile({name:payload.name});
  await Promise.allSettled([refreshOrders(false),refreshNotifications(false)]);
  toast('Bienvenue sur JorsenShop !');
  go(state.afterAuth?'commander':'compte/accueil');state.afterAuth=false;
 }catch(e){state.authError=e.message;renderNow();}
 finally{state.busy=false;renderNow();}
}
async function handleCheckout(form){
 if(state.busy)return;
 if(!state.user){state.afterAuth=true;go('compte/connexion');return;}
 const rows=cartLines();if(!rows.length){toast('Votre panier est vide.',true);return;}
 const fd=new FormData(form),mode=String(fd.get('mode')||state.paymentMode);
 const key=localStorage.getItem(REQUEST_KEY)||
  (crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):String(Date.now())+'order'+Math.random().toString(36).slice(2));
 localStorage.setItem(REQUEST_KEY,key);
 const payload={customerName:String(fd.get('name')||'').trim(),
   phone:String(fd.get('phone')||'').trim(),address:String(fd.get('address')||'').trim(),
   city:state.city,mode,notes:String(fd.get('notes')||'').trim(),
   paymentProvider:fd.get('paymentProvider')||null,idempotencyKey:key,
   items:rows.map(x=>({variantId:x.variant.id,size:x.size,quantity:x.quantity}))};
 state.busy=true;state.orderError='';
 try{
  const result=await send('/api/v2/orders',{method:'POST',body:JSON.stringify(payload)});
  localStorage.removeItem(REQUEST_KEY);
  if(typeof window.JORSEN_CLEAR_CART==='function')window.JORSEN_CLEAR_CART();
  await Promise.allSettled([refreshOrders(false),refreshNotifications(false)]);
  toast('Commande '+result.orderNumber+' enregistrée !');
  go('compte/commandes');
 }catch(e){state.orderError=e.message;toast(e.message,true);}
 finally{state.busy=false;renderNow();}
}
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-j2]');if(!el)return;
 const action=el.dataset.j2;
 e.preventDefault();
 if(action==='city')cityModal();
 else if(action==='select-city'){state.city=el.dataset.city;localStorage.setItem(STORAGE_CITY,state.city);cityModal();}
 else if(action==='city-continue'){if(state.city)closeCity();}
 else if(action==='login'||action==='register'){
  state.authError='';
  if(location.hash.includes('commander'))state.afterAuth=true;
  go('compte/'+(action==='login'?'connexion':'inscription'));
 }else if(action==='logout'){
  try{await send('/api/v2/auth?action=logout',{method:'POST',body:'{}'});}
  catch(err){toast(err.message,true);return}
  state.user=null;state.profile=null;state.orders=[];state.notifications=[];state.unread=0;
  state.afterAuth=false;go('compte/accueil');
 }else if(action==='chat')openChat(el.dataset.order);
 else if(action==='close-chat')closeChat();
 else if(action==='read'){
  try{await send('/api/v2/notifications',{method:'POST',body:JSON.stringify({id:el.dataset.id})});
   await refreshNotifications(false);
  }catch(err){toast(err.message,true)}
 }else if(action==='allow-notifications'&&typeof Notification!=='undefined'){
  try{toast(await window.JORSEN_ENABLE_PUSH());renderNow()}
  catch(err){toast(err.message,true)}
 }
});
document.addEventListener('submit',async e=>{
 const form=e.target;if(!form?.matches('[data-j2-form]'))return;
 e.preventDefault();e.stopImmediatePropagation();
 if(form.dataset.j2Form==='auth')await handleAuth(form);
 else if(form.dataset.j2Form==='checkout')await handleCheckout(form);
 else if(form.dataset.j2Form==='profile'){
  const fd=new FormData(form);
  try{await updateProfile({name:String(fd.get('name')||''),phone:String(fd.get('phone')||''),
   address:String(fd.get('address')||'')});toast('Profil mis à jour.');renderNow();
  }catch(err){toast(err.message,true)}
 }else if(form.dataset.j2Form==='chat'){
  const number=state.openChat,message=String(new FormData(form).get('message')||'').trim();
  if(!number||!message)return;
  try{await send('/api/v2/chat',{method:'POST',body:JSON.stringify({orderNumber:number,message})});
   form.reset();closeChat();openChat(number);
  }catch(err){toast(err.message,true)}
 }
},true);
document.addEventListener('change',e=>{
 if(e.target?.id==='j2-delivery-mode'){state.paymentMode=e.target.value;renderNow()}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.openChat)closeChat()});
window.addEventListener('hashchange',()=>{
 if(!state.user)return;
 if(/^#\/compte\/(commandes|messages|accueil)/.test(location.hash)||location.hash==='#/compte')
  Promise.allSettled([refreshOrders(false),refreshNotifications(false)]).then(()=>renderNow());
 else if(location.hash.includes('compte/notifications'))refreshNotifications(false);
});
window.JORSEN_V2_ACCOUNT_RENDER=accountMarkup;
window.JORSEN_V2_CHECKOUT_RENDER=checkoutMarkup;
init();
setInterval(()=>{if(!document.hidden&&state.user)refreshNotifications(true)},30000);
document.addEventListener('error',event=>{
 const img=event.target;if(!(img instanceof HTMLImageElement)||img.dataset.j2Error)return;
 img.dataset.j2Error='1';const src=img.currentSrc||img.src;
 if(src.includes('res.cloudinary.com')&&src.includes('/f_auto,')){
  img.src=src.replace(/\/f_auto,[^/]+\//,'/');return;
 }
 img.style.objectFit='contain';img.alt='Photo indisponible';
},true);
})();
