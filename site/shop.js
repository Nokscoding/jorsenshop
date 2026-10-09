(() => {
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function optimized(url,width=640){if(!url||typeof url!=='string')return url;try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='res.cloudinary.com'||!u.pathname.includes('/image/upload/'))return url;u.pathname=u.pathname.replace('/image/upload/','/image/upload/f_auto,q_auto,c_limit,w_'+Math.min(1200,Math.max(200,Number(width)||640))+'/');return u.toString()}catch{return url}}
const money=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n)||0)+' FC';
const modal=$('#modalRoot'),grid=$('#productsGrid'),status=$('#catalogueStatus');
const cartKey='jorsen_guest_cart_v1',ordersKey='jorsen_guest_orders_v1';
let products=[],cart=read(cartKey,[]),chosen=null;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function toast(message){const el=document.createElement('div');el.className='toast-item';el.textContent=message;$('#toast').append(el);setTimeout(()=>el.remove(),5000)}
async function api(path,opts={}){
 const res=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opts});
 const value=await res.json().catch(()=>({error:'Réponse non valide'}));
 if(!res.ok)throw Error(value.error||'Impossible de terminer cette opération');
 return value;
}
function validImage(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='res.cloudinary.com'}catch{return false}}
function photo(p,v=0){const url=p?.variants?.[v]?.images?.[0];return validImage(url)?optimized(url,800):null}
function showModal(title,html,large=false){
 modal.hidden=false;modal.innerHTML='<div class="modal-dialog '+(large?'large':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="modal-top"><h2>'+esc(title)+'</h2><button type="button" class="close" data-close>✕</button></div>'+html+'</div>';
 document.body.style.overflow='hidden'; $('[data-close]',modal).onclick=closeModal;
 modal.onclick=e=>{if(e.target===modal)closeModal()};
}
function closeModal(){modal.hidden=true;modal.innerHTML='';document.body.style.overflow=''}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeModal()});
function updateCount(){$('#cartCount').textContent=cart.reduce((n,i)=>n+i.quantity,0)}
function showCatalog(){
 const q=$('#searchInput').value.toLowerCase().trim(),cat=$('#categoryFilter').value,sort=$('#sortFilter').value;
 const list=products.filter(p=>(!cat||p.category===cat)&&(!q||(p.name+' '+p.category+' '+p.variants.map(v=>v.color).join(' ')).toLowerCase().includes(q)));
 if(sort==='asc')list.sort((a,b)=>a.price-b.price);else if(sort==='desc')list.sort((a,b)=>b.price-a.price);
 status.hidden=list.length>0;
 status.textContent=products.length?'Aucun article ne correspond à votre recherche.':'La collection sera disponible prochainement. Revenez découvrir nos nouveautés.';
 grid.innerHTML=list.map(p=>{
  const src=photo(p),badge=p.tag?'<span class="product-tag">'+esc(p.tag)+'</span>':'';
  return '<article class="product-card"><div class="product-media">'+(src?'<img src="'+esc(src)+'" alt="'+esc(p.name)+'" loading="lazy" decoding="async">':'<span class="image-placeholder">JORSENSHOP · PHOTO À VENIR</span>')+badge+'</div><div class="product-info"><small>'+esc(p.category)+'</small><h3>'+esc(p.name)+'</h3><strong>'+money(p.price)+'</strong><footer><button data-product="'+esc(p.id)+'" type="button">Choisir couleur & taille →</button></footer></div></article>';
 }).join('');
 $$('[data-product]',grid).forEach(btn=>btn.onclick=()=>showProduct(btn.dataset.product));
}
function $$(selector,root=document){return [...root.querySelectorAll(selector)]}
function showProduct(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 const variants=p.variants||[],sizes=p.sizes||[],v=variants[0];let idx=0,sz=sizes[0]||'';
 const body='<div class="modal-product"><div id="productImage"></div><div><div class="eyebrow">'+esc(p.category)+'</div><h3>'+esc(p.name)+'</h3><h2>'+money(p.price)+'</h2><p>'+esc(p.description||'Sélection Jorsenshop')+'</p><b>Couleur</b><div id="variantOptions" class="select-row">'+variants.map((a,i)=>'<button type="button" class="pill '+(i===0?'active':'')+'" data-variant="'+i+'">'+esc(a.color)+'</button>').join('')+'</div><b>Taille</b><div id="sizeOptions" class="select-row">'+sizes.map((a,i)=>'<button type="button" class="pill '+(i===0?'active':'')+'" data-size="'+esc(a)+'">'+esc(a)+'</button>').join('')+'</div><label class="field">Quantité<input id="qty" type="number" min="1" max="10" value="1"></label><button class="primary-button" id="addCart" type="button">Ajouter au panier →</button></div></div>';
 showModal(p.name,body,true);
 function renderImg(){const url=photo(p,idx);$('#productImage',modal).innerHTML=url?'<img src="'+esc(url)+'" alt="'+esc(p.name)+'">':'<div class="image-placeholder" style="padding:90px 20px">PHOTO BIENTÔT DISPONIBLE</div>'}
 renderImg();
 $$('[data-variant]',modal).forEach(btn=>btn.onclick=()=>{idx=Number(btn.dataset.variant);$$('[data-variant]',modal).forEach(x=>x.classList.toggle('active',x===btn));renderImg()});
 $$('[data-size]',modal).forEach(btn=>btn.onclick=()=>{sz=btn.dataset.size;$$('[data-size]',modal).forEach(x=>x.classList.toggle('active',x===btn))});
 $('#addCart',modal).onclick=()=>{
   const qty=Number($('#qty',modal).value);if(!Number.isInteger(qty)||qty<1||qty>10)return toast('Quantité incorrecte');
   if(!sz)return toast('Choisis une taille');
   const key=p.id+'|'+variants[idx].id+'|'+sz,old=cart.find(x=>x.key===key);
   if(old)old.quantity=Math.min(10,old.quantity+qty);
   else cart.push({key,productId:p.id,variantId:variants[idx].id,size:sz,quantity:qty});
   store(cartKey,cart);updateCount();closeModal();toast('Article ajouté au panier');
 };
}
function cartLines(){
 return cart.map((item,index)=>{
  const p=products.find(x=>x.id===item.productId),v=p?.variants.find(x=>x.id===item.variantId);
  if(!p||!v)return '';
  const src=photo(p,p.variants.indexOf(v));
  return '<div class="cart-row">'+(src?'<img src="'+esc(src)+'" alt="">':'<div class="image-placeholder">J</div>')+'<div><b>'+esc(p.name)+'</b><small>'+esc(v.color)+' · '+esc(item.size)+' · Qté '+item.quantity+'</small><strong>'+money(p.price*item.quantity)+'</strong></div><button data-remove="'+index+'" aria-label="Retirer">Retirer</button></div>';
 }).join('');
}
function openCart(){
 const valid=cart.filter(x=>products.some(p=>p.id===x.productId&&p.variants.some(v=>v.id===x.variantId)));
 if(valid.length!==cart.length){cart=valid;store(cartKey,cart);updateCount()}
 if(!cart.length)return showModal('Mon panier','<p>Ton panier est encore vide.</p><button class="primary-button" data-close-empty>Découvrir la collection</button>');
 const total=cart.reduce((sum,i)=>sum+(products.find(p=>p.id===i.productId)?.price||0)*i.quantity,0);
 showModal('Mon panier',cartLines()+'<div class="cart-total"><span>Sous-total</span><b>'+money(total)+'</b></div><p style="font-size:12px;color:#738">Frais de livraison communiqués lors de la confirmation.</p><div class="modal-actions"><button class="primary-button" id="checkoutOpen">Passer commande →</button></div>');
 $$('[data-remove]',modal).forEach(btn=>btn.onclick=()=>{cart.splice(Number(btn.dataset.remove),1);store(cartKey,cart);updateCount();closeModal();openCart()});
 $('#checkoutOpen',modal).onclick=openCheckout;
 const empty=$('[data-close-empty]',modal);if(empty)empty.onclick=closeModal;
}
function openCheckout(){
 showModal('Passer commande',`<form id="checkoutForm" class="checkout">
 <label>Nom complet *<input name="name" required minlength="2" maxlength="100" autocomplete="name"></label>
 <label>Téléphone *<input name="phone" required minlength="7" maxlength="32" autocomplete="tel"></label>
 <label>Ville *<input name="city" required value="Lubumbashi"></label>
 <label class="wide">Adresse de livraison *<input name="address" required minlength="8" maxlength="350" autocomplete="street-address"></label>
 <label class="wide">Précisions (facultatif)<textarea name="notes" maxlength="600" rows="3" placeholder="Quartier, repère, instructions..."></textarea></label>
 <div class="wide notice">Paiement à la livraison. Aucun compte client ni paiement bancaire nécessaire.</div>
 <button class="primary-button wide" type="submit">Confirmer ma commande</button>
 </form>`);
 $('#checkoutForm',modal).onsubmit=async e=>{
  e.preventDefault();const form=e.target,button=$('button[type="submit"]',form);
  button.disabled=true;button.textContent='Enregistrement…';
  const data=new FormData(form);
  const idem=crypto.randomUUID().replaceAll('-','');
  try{
   const result=await api('/api/orders',{method:'POST',body:JSON.stringify({
    customerName:data.get('name'),phone:data.get('phone'),city:data.get('city'),address:data.get('address'),notes:data.get('notes'),
    items:cart.map(i=>({variantId:i.variantId,size:i.size,quantity:i.quantity})),idempotencyKey:idem
   })});
   const histories=read(ordersKey,[]);histories.unshift({orderNumber:result.orderNumber,trackingToken:result.trackingToken,total:result.total});
   store(ordersKey,histories.slice(0,30));cart=[];store(cartKey,cart);updateCount();
   showModal('Commande enregistrée','<p><b>Merci !</b> Votre référence : <strong>'+esc(result.orderNumber)+'</strong>.</p><p>Montant des articles : <b>'+money(result.total)+'</b>. Nous vous contacterons pour confirmer votre livraison.</p><div class="notice">Gardez votre référence. La commande est également sauvegardée sur cet appareil.</div>');
  }catch(error){toast(error.message);button.disabled=false;button.textContent='Réessayer'}
 };
}
async function orderHistory(){
 const list=read(ordersKey,[]);
 if(!list.length)return showModal('Mes commandes','<p>Aucune commande enregistrée sur cet appareil.</p><p>Si tu as commandé depuis un autre appareil, contacte directement le gérant avec ta référence.</p>');
 showModal('Mes commandes','<div id="orderRows">Chargement…</div>');
 const rows=await Promise.all(list.map(async a=>{
  try{const r=await api('/api/order-status',{method:'POST',body:JSON.stringify(a)});return '<div class="cart-row"><div>📦</div><div><b>'+esc(r.order.number)+'</b><small>'+esc(r.order.status)+' · '+esc(r.order.payment)+'</small></div><b>'+money(r.order.total)+'</b></div>'}
  catch{return '<p>'+esc(a.orderNumber)+' · Statut indisponible</p>'}
 }));
 $('#orderRows',modal).innerHTML=rows.join('');
}
async function load(){
 try{
   const r=await api('/api/products');products=(r.products||[]).filter(p=>p.variants?.length);
   const categories=[...new Set(products.map(p=>p.category))].sort();
   $('#categoryFilter').innerHTML='<option value="">Toutes les catégories</option>'+categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
   showCatalog();
 }catch(e){status.hidden=false;status.textContent='La boutique est temporairement en préparation. Aucun achat ne peut être effectué actuellement.';toast('Catalogue momentanément indisponible')}
}
$('#cartBtn').onclick=openCart;
$('#historyBtn').onclick=orderHistory;
['searchInput','categoryFilter','sortFilter'].forEach(id=>$('#'+id).addEventListener(id==='searchInput'?'input':'change',showCatalog));
updateCount();load();
})();