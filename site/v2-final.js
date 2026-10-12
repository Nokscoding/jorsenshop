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
   (typeof Notification!=='undefined'&&Notification.permission==='default'?
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
