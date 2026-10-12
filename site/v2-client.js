/* JorsenShop V2 enhancement of the APPROVED V1.1 interface; no framework/design replacement. */
(() => {
 'use strict';
 if(window.JORSEN_PORTAL && window.JORSEN_PORTAL!=='public')return;
 const KEY='jorsenshop_v2_city';
 const $=(q,root=document)=>root.querySelector(q);
 const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=x=>new Intl.NumberFormat('fr-FR').format(Number(x)||0)+' FC';
 const fetchJSON=async(url,options={})=>{
   const r=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...options});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.error||'Service momentanément indisponible');
   return data;
 };
 let city=localStorage.getItem(KEY)||'',user=null,openedChat=null,ordersLoading=false;
 let cities=[],shipping=null;
 const RECEIPTS_KEY='jorsenshop_v2_guest_receipts';
 const receipts=()=>{
   try{const v=JSON.parse(localStorage.getItem(RECEIPTS_KEY)||'[]');
    return Array.isArray(v)?v.filter(x=>/^JS-[0-9]{8}-[0-9]{6}$/.test(x.number)&&
      /^[A-Za-z0-9_-]{32,100}$/.test(x.token)).slice(0,40):[];
   }catch{return []}
 };
 const receiptFor=number=>receipts().find(x=>x.number===number)?.token||'';
 function saveReceipt(number,token){
  if(!/^[A-Za-z0-9_-]{32,100}$/.test(String(token||'')))return;
  const list=receipts().filter(x=>x.number!==number);
  list.unshift({number,token,city,date:new Date().toISOString()});
  localStorage.setItem(RECEIPTS_KEY,JSON.stringify(list.slice(0,40)));
 }
 const css=document.createElement('style');
 css.textContent=[
 '.v2-veil{position:fixed;inset:0;background:#f6f9fb;z-index:15000;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto;font-family:inherit;color:#14253f}',
 '.v2-box{width:min(100%,450px);background:white;border-radius:23px;padding:26px;box-shadow:0 20px 65px #14253f20;border:1px solid #e3eaec}',
 '.v2-mark{font-weight:900;font-size:24px;color:#14253f;letter-spacing:-1px}.v2-mark b{color:#56c4ae}',
 '.v2-kicker{font-size:11px;font-weight:800;letter-spacing:2px;color:#57b9a8;margin:25px 0 7px}',
 '.v2-box h2{font-size:27px;letter-spacing:-.8px;margin:0 0 9px;line-height:1.2;color:#14253f}',
 '.v2-box p{color:#687c8c;font-size:14px;line-height:1.6;margin:0 0 22px}',
 '.v2-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
 '.v2-city{border:1px solid #dde6ea;background:#fff;border-radius:13px;padding:20px 12px;text-align:left;cursor:pointer;color:#182e48;font-weight:750}',
 '.v2-city span{display:block;color:#7890a1;font-size:11px;font-weight:500;margin-top:5px}',
 '.v2-city.selected{border:2px solid #50c2ad;background:#f1fcfa}',
 '.v2-box label{display:block;font-size:12px;font-weight:750;color:#536679;margin-top:14px}',
 '.v2-box input,.v2-box select{width:100%;margin-top:5px;padding:13px 14px;border:1px solid #d8e3ea;background:#fafcfd;color:#162d43;border-radius:10px;font-size:16px;box-sizing:border-box}',
 '.v2-btn{display:block;width:100%;padding:14px;margin-top:19px;border:none;border-radius:12px;color:#fff;background:#112e4d;font-size:15px;font-weight:800;cursor:pointer}',
 '.v2-link{display:block;margin:15px auto 0;background:none;border:0;color:#168d80;font-weight:750;cursor:pointer;text-align:center}',
 '.v2-error{padding:10px 12px;border-radius:10px;background:#fff1f1;color:#a22;font-size:13px;margin-top:14px}',
 '.v2-real-orders{margin:30px 0;padding:20px;border:1px solid #dce7e8;border-radius:16px;background:#fff}',
 '.v2-order-row{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:13px 0;border-bottom:1px solid #edf1f2}',
 '.v2-order-row small{display:block;color:#687b8d;margin-top:4px}',
 '.v2-mini-btn{border:1px solid #53baa9;color:#19665c;background:#eefcf9;border-radius:9px;padding:7px 11px;font-size:12px;font-weight:700;cursor:pointer}',
 '.v2-dialog{position:fixed;inset:0;z-index:15100;background:#081527ae;display:flex;align-items:center;justify-content:center;padding:15px}',
 '.v2-dialog-content{background:#fff;width:min(100%,530px);max-height:85vh;overflow:auto;border-radius:18px;padding:20px}',
 '.v2-chat-log{height:280px;overflow-y:auto;padding:12px;background:#f3f7fa;border-radius:10px;margin:12px 0}',
 '.v2-chat-msg{background:#fff;border-radius:10px;padding:10px;margin:8px 0;font-size:14px;max-width:88%}',
 '.v2-chat-msg.mine{margin-left:auto;background:#dbf7f0}',
 '.v2-chat-form{display:flex;gap:8px}.v2-chat-form input{flex:1;min-width:0;padding:11px;border-radius:9px;border:1px solid #cad8e2}',
 '.v2-chat-form button{background:#173c5c;color:#fff;border:none;padding:0 16px;border-radius:9px}',
 '.v2-note{font-size:12px;padding:11px 13px;background:#eff7f9;border-radius:10px;color:#425968;margin:10px 0}',
 '.v2-option{display:block!important;padding:7px 0;color:#183b53;font-size:13px}',
 '.v2-confirm{position:fixed;z-index:15101;left:18px;right:18px;bottom:20px;margin:auto;max-width:450px;background:#142e49;color:#fff;padding:17px;border-radius:13px;box-shadow:0 10px 35px #14253f30;line-height:1.6}',
 '.v2-confirm button{background:none;border:0;color:#6cdbc8;float:right;cursor:pointer;font-weight:800}',
 '@media(max-width:460px){.v2-box{padding:22px}.v2-box h2{font-size:24px}.v2-city{padding:16px 10px}}'
 ].join('\n');
 document.head.append(css);
 const notify=msg=>{
  const old=$('.v2-confirm');if(old)old.remove();
  const el=document.createElement('div');el.className='v2-confirm';
  el.innerHTML='<button aria-label="Fermer">×</button>'+h(msg);
  document.body.append(el);el.querySelector('button').onclick=()=>el.remove();
 };
 function veil(html){
  let el=$('#v2-veil');
  if(!el){el=document.createElement('div');el.id='v2-veil';el.className='v2-veil';document.body.append(el)}
  el.innerHTML='<section class="v2-box" role="dialog" aria-modal="true" aria-label="Accéder à JorsenShop"><div class="v2-mark">Jorsen<b>shop</b></div>'+html+'</section>';
  return el;
 }
 function showCities(){
  const el=veil('<div class="v2-kicker">BIENVENUE</div><h2>Dans quelle ville faites-vous vos achats ?</h2>'+
    '<p>Choisissez votre ville pour connaître les frais et les modalités de livraison.</p>'+
    '<div class="v2-grid">'+cities.map(c=>'<button class="v2-city'+(city===c.id?' selected':'')+
    '" data-city="'+h(c.id)+'">'+h(c.name)+'<span>'+(c.mode==='local'?'Livraison à domicile':'Expédition par agence')+'</span></button>').join('')+
    '</div><button id="v2-next" class="v2-btn" '+(city?'':'disabled')+'>Continuer</button>');
  el.querySelectorAll('[data-city]').forEach(btn=>btn.onclick=()=>{
   city=btn.dataset.city;localStorage.setItem(KEY,city);
   el.querySelectorAll('[data-city]').forEach(x=>x.classList.toggle('selected',x===btn));
   el.querySelector('#v2-next').disabled=false;
  });
  el.querySelector('#v2-next').textContent='Accéder à la boutique';
  el.querySelector('#v2-next').onclick=async()=>{
   try{
    if(user)await fetchJSON('/api/v2/me',{method:'POST',body:JSON.stringify({city})});
    $('#v2-veil')?.remove();
    await loadLiveCatalogue();enhanceCheckout();loadOrders();
   }catch(err){notify(err.message)}
  };
 }
 function showAuth(mode='signup'){
  const signup=mode==='signup';
  const el=veil('<div class="v2-kicker">'+h(cities.find(x=>x.id===city)?.name||city)+'</div><h2>'+
   (signup?'Créer mon compte':'Se connecter')+'</h2><p>Le compte est facultatif. Il permet de retrouver vos achats sur plusieurs appareils.</p>'+
   '<form id="v2-auth-form"><label>Adresse e-mail<input name="email" type="email" autocomplete="email" required></label>'+
   '<label>Mot de passe<input name="password" type="password" minlength="8" autocomplete="'+(signup?'new-password':'current-password')+'" required></label>'+
   '<div id="v2-auth-error" role="alert"></div><button class="v2-btn" type="submit">'+
   (signup?'Créer un compte':'Connexion')+'</button></form>'+
   '<button class="v2-link" id="v2-switch">'+(signup?'Déjà inscrit ? Se connecter':'Nouveau client ? Créer un compte')+'</button>'+
   '<button class="v2-link" id="v2-guest">Continuer sans compte</button>'+
   '<button class="v2-link" id="v2-back">← Changer de ville</button>');
  $('#v2-switch',el).onclick=()=>showAuth(signup?'login':'signup');
  $('#v2-back',el).onclick=showCities;
  $('#v2-guest',el).onclick=async()=>{$('#v2-veil')?.remove();await loadLiveCatalogue();enhanceCheckout();loadOrders()};
  $('#v2-auth-form',el).onsubmit=async e=>{
   e.preventDefault();const data=new FormData(e.target),button=e.target.querySelector('button');
   button.disabled=true;const error=$('#v2-auth-error',el);error.textContent='';
   try{
    await fetchJSON('/api/v2/auth?action='+(signup?'signup':'login'),{method:'POST',
      body:JSON.stringify({email:data.get('email'),password:data.get('password')})});
    const session=await fetchJSON('/api/v2/auth?action=session').catch(()=>({authenticated:false}));
    if(!session.authenticated)throw Error('Connexion non confirmée. Réessayez.');
    user=session.user;
    await fetchJSON('/api/v2/me',{method:'POST',
      body:JSON.stringify({city})});
    $('#v2-veil')?.remove();
    notify('Bienvenue sur JorsenShop ! Votre ville : '+(cities.find(c=>c.id===city)?.name||city));
    await loadLiveCatalogue();
    enhanceCheckout();
    loadOrders();
   }catch(err){error.className='v2-error';error.textContent=err.message}
   finally{button.disabled=false;}
  };
 }
 async function loadLiveCatalogue(){
  try{
   const result=await fetchJSON('/api/products');
   const current=(result.products||[]).filter(x=>Array.isArray(x.variants)&&x.variants.length>0);
   if(typeof window.JORSEN_SET_LIVE_CATALOGUE==='function')window.JORSEN_SET_LIVE_CATALOGUE(current);
  }catch(e){
   // A failed catalogue call must not expose mock items as purchasable products.
   if(typeof window.JORSEN_SET_LIVE_CATALOGUE==='function')window.JORSEN_SET_LIVE_CATALOGUE([]);
   notify('Catalogue momentanément indisponible : aucune commande possible.');
  }
 }
 async function init(){
  try{
   const result=await fetchJSON('/api/v2/cities');cities=result.cities||[];
   if(!cities.length)throw Error('Villes indisponibles');
   const session=await fetchJSON('/api/v2/auth?action=session');
   user=session.user||null;
   if(user){
     try{const info=await fetchJSON('/api/v2/me');if(!city&&info.profile?.city_code)city=info.profile.city_code}
     catch{}
   }
   if(!cities.some(c=>c.id===city)){city='';showCities()}
   else {await loadLiveCatalogue();enhanceCheckout();loadOrders()}
  }catch(err){
   const el=veil('<div class="v2-kicker">JORSENSHOP V2</div><h2>Site en préparation</h2>'+
    '<p>Le service de connexion est momentanément indisponible. Aucune commande réelle ne peut être enregistrée.</p>'+
    '<button class="v2-btn" id="v2-retry">Réessayer</button>');
   $('#v2-retry',el).onclick=()=>{el.remove();init()};
  }
 }
 async function quote(mode){
  return (await fetchJSON('/api/v2/shipping-quote',{method:'POST',
    body:JSON.stringify({city,mode})})).quote;
 }
 let augmenting=false;
 async function enhanceCheckout(){
  if(augmenting||!city)return;
  const form=document.querySelector('[data-form="checkout"]');
  if(!form||form.querySelector('#v2-shipping-mode'))return;
  augmenting=true;
  try{
   let q=await quote(city==='lubumbashi'?'normal':'expedition');
   const target=form.querySelector('[name="city"]');
   if(target){target.value=q.cityLabel;target.setAttribute('readonly','readonly')}
   const field=document.createElement('section');field.className='v2-shipping';
   field.innerHTML='<div class="v2-note" id="v2-fee">Livraison : '+money(q.deliveryFeeFc)+'</div>'+
    (city==='lubumbashi'?
      '<label>Mode de livraison<select id="v2-shipping-mode" name="v2_shipping_mode"><option value="normal">Normale — 7 000 FC</option><option value="express">Express — 15 000 FC</option></select></label>':
      '<input type="hidden" id="v2-shipping-mode" value="expedition">'+
      '<div class="v2-note">Paiement avant achat et expédition via KKS / NGOKAF. Frais : 10 000 FC.</div>'+
      '<label>Moyen de paiement<select id="v2-payment-provider" required><option value="">Choisir</option><option value="airtel_money">Airtel Money</option><option value="orange_money">Orange Money</option></select></label>');
   form.prepend(field);
   const modeField=$('#v2-shipping-mode',form);
   modeField.onchange=async()=>{try{q=await quote(modeField.value);$('#v2-fee',form).textContent='Livraison : '+money(q.deliveryFeeFc)}catch(e){notify(e.message)}};
  }finally{augmenting=false}
 }
 document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!form.matches('[data-form="checkout"]')||!city)return;
  e.preventDefault();e.stopImmediatePropagation();
  const btn=form.querySelector('[type="submit"]');
  if(btn)btn.disabled=true;
  try{
   const f=new FormData(form),cart=typeof window.JORSEN_CART_ITEMS==='function'?window.JORSEN_CART_ITEMS():[];
   const base=window.JORSEN_CATALOG||[];
   const items=cart.map(row=>{
     const p=base.find(x=>x.id===row.id);
     return {variantId:p?.variants?.[row.variant]?.id,size:row.size,quantity:Number(row.qty)};
   });
   if(!items.length||items.some(x=>!x.variantId))throw Error('Votre panier doit être actualisé.');
   const mode=$('#v2-shipping-mode',form)?.value||'normal';
   const q=await quote(mode);
   const address=[f.get('address'),f.get('district'),q.cityLabel].filter(Boolean).join(', ');
   const payload={
    customerName:String(f.get('name')||'').trim(),
    phone:String(f.get('phone')||'').trim(),city:q.city,mode,
    address,notes:String(f.get('note')||'').trim(),
    paymentProvider:$('#v2-payment-provider',form)?.value||null,
    items,idempotencyKey:crypto.randomUUID().replaceAll('-','')
   };
   const result=await fetchJSON('/api/v2/orders',{method:'POST',body:JSON.stringify(payload)});
   saveReceipt(result.orderNumber,result.trackingToken);
   if(typeof window.JORSEN_CLEAR_CART==='function')window.JORSEN_CLEAR_CART();
   notify('Commande '+result.orderNumber+' enregistrée. Total : '+money(result.total)+'. '+result.instruction+
    ' Conservez cette référence pour suivre la commande.');
   if(!user)location.hash='#/compte/commandes';
   loadOrders();
  }catch(err){notify(err.message)}
  finally{if(btn)btn.disabled=false;}
 },true);
 async function loadOrders(){
  if(ordersLoading||!location.hash.includes('compte'))return;
  const main=$('#app main')||document.querySelector('main');
  if(!main||$('.v2-real-orders',main))return;
  ordersLoading=true;
  try{
   const saved=receipts();
   let rows=[];
   if(user){
     try{const r=await fetchJSON('/api/v2/orders');rows=(r.orders||[]).map(o=>({
       number:o.order_number,city:o.delivery_city,status:o.status,payment:o.payment_status,total:o.totalFc
     }));}catch{}
   }
   for(const receipt of saved){
    if(rows.some(o=>o.number===receipt.number))continue;
    try{
     const r=await fetchJSON('/api/order-status',{method:'POST',body:JSON.stringify({
       orderNumber:receipt.number,trackingToken:receipt.token
     })});
     rows.push({number:receipt.number,city:receipt.city,
       status:r.order.status,payment:r.order.payment,total:r.order.total});
    }catch{/* The receipt stays on this device for later retry. */}
   }
   const panel=document.createElement('section');panel.className='v2-real-orders';
   panel.innerHTML='<div class="v2-order-row"><h2>Suivi de mes commandes</h2>'+
     '<button class="v2-mini-btn" data-v2-change-city>Ville : '+h(cities.find(x=>x.id===city)?.name||city)+'</button></div>'+
     (rows.length?rows.map(o=>'<div class="v2-order-row"><div><strong>'+h(o.number)+'</strong>'+
      '<small>'+h(o.city||'')+' · '+h(o.status)+' · '+h(o.payment)+'</small>'+
      '<small>'+money(o.total)+'</small></div><button class="v2-mini-btn" data-v2-order="'+
      h(o.number)+'">Suivre et discuter</button></div>').join(''):
      '<p>Aucune commande enregistrée. Vous pouvez acheter sans créer de compte.</p>')+
     (!user?'<div class="v2-order-row"><button class="v2-mini-btn" data-v2-auth="signup">Créer un compte (facultatif)</button>'+
      '<button class="v2-mini-btn" data-v2-auth="login">Se connecter</button></div>':'');
   main.append(panel);
  }finally{ordersLoading=false}
 }
 async function showChat(number){
  openedChat=number;
  const guestToken=receiptFor(number);
  const wrap=document.createElement('div');wrap.className='v2-dialog';wrap.id='v2-chat-dialog';
  wrap.innerHTML='<div class="v2-dialog-content" role="dialog" aria-modal="true">'+
   '<button class="v2-mini-btn" id="v2-close-chat">Fermer</button><h2>Commande '+h(number)+'</h2>'+
   '<p class="v2-note">Conversation privée avec la boutique liée à cette commande.</p>'+
   '<div class="v2-chat-log" id="v2-chat-log"></div>'+
   '<form class="v2-chat-form" id="v2-chat-form"><input name="message" maxlength="2000" placeholder="Votre message..." required>'+
   '<button type="submit">Envoyer</button></form></div>';
  document.body.append(wrap);
  $('#v2-close-chat',wrap).onclick=()=>{wrap.remove();openedChat=null};
  wrap.onclick=e=>{if(e.target===wrap){wrap.remove();openedChat=null}};
  async function refresh(){
    if(openedChat!==number)return;
    try{
     const r=guestToken?await fetchJSON('/api/v2/chat',{method:'POST',
      body:JSON.stringify({action:'list',orderNumber:number,trackingToken:guestToken})}):
      await fetchJSON('/api/v2/chat?orderNumber='+encodeURIComponent(number));
     const node=$('#v2-chat-log',wrap);
     node.innerHTML=(r.messages||[]).map(m=>
       '<div class="v2-chat-msg'+(m.isMine?' mine':'')+'">'+h(m.message)+'</div>').join('');
     node.scrollTop=node.scrollHeight;
    }catch{}
  }
  $('#v2-chat-form',wrap).onsubmit=async e=>{
    e.preventDefault();const f=e.target,msg=String(new FormData(f).get('message')||'').trim();
    if(!msg)return;
    try{await fetchJSON('/api/v2/chat',{method:'POST',
      body:JSON.stringify({orderNumber:number,message:msg,trackingToken:guestToken})});f.reset();refresh()}
    catch(err){notify(err.message)}
  };
  refresh();
 }
 document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-v2-order]');
  if(btn)showChat(btn.dataset.v2Order);
  const auth=e.target.closest('[data-v2-auth]');
  if(auth)showAuth(auth.dataset.v2Auth);
  if(e.target.closest('[data-v2-change-city]'))showCities();
 });
 window.addEventListener('hashchange',()=>{setTimeout(()=>{enhanceCheckout();loadOrders()},150)});
 const observer=new MutationObserver(()=>{if(!city)return;enhanceCheckout();loadOrders()});
 function start(){observer.observe(document.body,{childList:true,subtree:true});init();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
 // CDN fallback: show a clear state instead of the browser's broken-image icon.
 document.addEventListener('error',event=>{
  const img=event.target;
  if(!(img instanceof HTMLImageElement)||img.dataset.v2Fallback)return;
  img.dataset.v2Fallback='1';
  const src=img.currentSrc||img.src;
  if(src.includes('res.cloudinary.com')&&src.includes('/image/upload/')&&src.includes('/f_auto,')){
    img.src=src.replace(/\/f_auto,[^/]+\//,'/');
    return;
  }
  const placeholder=document.createElement('div');
  placeholder.className='v2-photo-unavailable';
  placeholder.textContent='Photo momentanément indisponible';
  placeholder.style.cssText='display:grid;place-items:center;min-height:180px;background:#f1f4f6;color:#738196;font-size:13px;text-align:center';
  img.replaceWith(placeholder);
 },true);
})();