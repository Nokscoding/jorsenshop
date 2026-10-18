(function runStorefrontMarketing(){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const money=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n)||0)+' FC';
 let slides=[],discounts=new Map(),timer=null,activeSection=null;
 function cleanUrl(url){
  try{
   const u=new URL(url,location.origin);
   return u.protocol==='https:'&&u.hostname==='res.cloudinary.com'&&u.pathname.includes('/jorsenshop/')?u.toString():null;
  }catch{return null}
 }
 function validDestination(href){
  return /^#\/[a-zA-Z0-9?=_&%./-]{1,180}$/.test(href)||/^\/(?!\/)[a-zA-Z0-9/_#?=%&.-]{0,180}$/.test(href)?href:'#/catalogue';
 }
 function sync(slideIndex){
  const stage=activeSection;if(!stage||!stage.isConnected)return;
  const n=(slideIndex+slides.length)%slides.length;
  stage.dataset.marketingIndex=String(n);
  stage.querySelectorAll('.carousel-slide').forEach((el,i)=>{
   const selected=i===n;el.classList.toggle('is-active',selected);
   el.setAttribute('aria-hidden',String(!selected));
   const a=el.querySelector('a');if(a)a.tabIndex=selected?0:-1;
  });
  stage.querySelectorAll('.carousel-dot').forEach((el,i)=>{
   el.classList.toggle('is-active',i===n);el.setAttribute('aria-current',String(i===n));
  });
 }
 function enhanceCarousel(){
  if(!slides.length)return;
  const section=document.querySelector('#app .shop-carousel');
  if(!section||section.dataset.marketingApplied==='1')return;
  const markup=slides.map((s,i)=>{
   const src=cleanUrl(s.mediaUrl);if(!src)return '';
   return `<article class="carousel-slide${i===0?' is-active':''}" data-marketing-slide="${i}" aria-hidden="${i!==0}">
     <img src="${esc(src)}" alt="${esc(s.eyebrow||s.headline)}" ${i?'loading="lazy"':'fetchpriority="high"'}>
     <div class="carousel-media-shade"></div>
     <div class="wide carousel-content"><div class="carousel-copy">
       ${s.eyebrow?`<span class="carousel-kicker">${esc(s.eyebrow)}</span>`:''}
       <h1>${esc(s.headline)}</h1>
       ${s.description?`<p>${esc(s.description)}</p>`:''}
       <a class="carousel-cta" href="${esc(validDestination(s.destination||'#/catalogue'))}" tabindex="${i===0?0:-1}">${esc(s.cta||'Découvrir')} <span aria-hidden="true">→</span></a>
     </div></div>
    </article>`;
  }).join('');
  if(!markup)return;
  section.innerHTML=`<div class="carousel-stage">${markup}</div>
    <div class="carousel-controls">
      <button type="button" data-marketing-prev aria-label="Image précédente">←</button>
      <div class="carousel-dots">${slides.map((_,i)=>`<button type="button" class="carousel-dot${i===0?' is-active':''}" data-marketing-dot="${i}" aria-current="${i===0}" aria-label="Voir l’offre ${i+1}"></button>`).join('')}</div>
      <button type="button" data-marketing-next aria-label="Image suivante">→</button>
    </div>`;
  section.dataset.marketingApplied='1';
  section.setAttribute('aria-label','Offres spéciales Jorsenshop');
  activeSection=section;
  section.querySelector('[data-marketing-prev]').addEventListener('click',e=>{e.stopPropagation();sync(Number(section.dataset.marketingIndex||0)-1)});
  section.querySelector('[data-marketing-next]').addEventListener('click',e=>{e.stopPropagation();sync(Number(section.dataset.marketingIndex||0)+1)});
  section.querySelectorAll('[data-marketing-dot]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();sync(Number(btn.dataset.marketingDot))}));
  sync(0);
  if(timer)clearInterval(timer);
  timer=setInterval(()=>{if(!section.isConnected||document.hidden||section.matches(':hover')||section.contains(document.activeElement))return;sync(Number(section.dataset.marketingIndex||0)+1)},6500);
 }
 function enhanceDiscounts(){
  if(!discounts.size)return;
  document.querySelectorAll('#app .product-card').forEach(card=>{
   const href=card.querySelector('a[href^="#/produit/"]')?.getAttribute('href')||'';
   const id=href.match(/^#\/produit\/(js-[a-zA-Z0-9_-]+)/)?.[1],d=discounts.get(id);
   const priceEl=card.querySelector('.product-price');
   if(!d||!priceEl||priceEl.dataset.marketingPrice===String(d.value)+d.kind)return;
   const discounted=d.kind==='percent'?Math.max(0,d.basePrice-Math.round(d.basePrice*d.value/100)):Math.max(0,d.basePrice-d.value);
   if(discounted>=d.basePrice)return;
   priceEl.dataset.marketingPrice=String(d.value)+d.kind;
   priceEl.innerHTML=`<del class="js-promo-original">${money(d.basePrice)}</del> <strong class="js-promo-price">${money(discounted)}</strong>`;
  });
 }

 function quoteItems(){
  let cart=[];
  try{cart=JSON.parse(localStorage.getItem('jorsen_v1_cart')||'[]')}catch{}
  if(!Array.isArray(cart)||cart.length<1)return null;
  const items=cart.map(c=>({variantId:String(c.id||'')+'-v'+(Number(c.variant)+1),size:String(c.size||''),quantity:Number(c.qty)}));
  return items.every(i=>/^js-[a-zA-Z0-9_-]+-v[1-9][0-9]*$/.test(i.variantId)&&i.size.length<=16&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=10)?items:null;
 }
 function enhanceCheckout(){
  const form=document.querySelector('#checkout-form[data-form="checkout"]');
  if(!form||form.dataset.marketingCheckout==='1')return;
  form.dataset.marketingCheckout='1';
  const aside=form.querySelector('aside');
  const button=form.querySelector('button[type="submit"]');
  if(!aside||!button)return;
  const panel=document.createElement('div');
  panel.className='js-marketing-checkout';
  panel.innerHTML='<label class="field">Code promo (facultatif)<input id="js-marketing-code" name="promoCode" autocomplete="off" maxlength="32" placeholder="Ex. NOEL20"></label><button type="button" class="btn btn-outline btn-sm" id="js-marketing-quote">Vérifier le code</button><p id="js-marketing-result" class="helper" role="status" aria-live="polite">Les remises sont calculées par Jorsenshop au moment de la commande.</p>';
  button.before(panel);
  const result=panel.querySelector('#js-marketing-result'),input=panel.querySelector('#js-marketing-code');
  const quote=async()=>{
   const items=quoteItems();
   if(!items){result.textContent='Panier non reconnu. Rechargez la boutique.';return null}
   const code=input.value.trim().toUpperCase();
   try{
    const r=await fetch('/api/quote',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,promoCode:code})});
    const body=await r.json();
    if(!r.ok)throw Error(body.error||'Code promotionnel indisponible');
    result.textContent='Sous-total après réductions : '+money(body.total)+' (hors livraison) · Économies : '+money(body.discount);
    result.dataset.quoteOk='1';return body;
   }catch(e){
    result.dataset.quoteOk='0';
    result.textContent=e.message||'Offre non disponible';return null;
   }
  };
  panel.querySelector('#js-marketing-quote').addEventListener('click',quote);
  input.addEventListener('input',()=>{result.dataset.quoteOk='0';result.textContent='Vérifiez le code avant de continuer.'});
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   event.stopImmediatePropagation();
   result.textContent='Vérification de la commande…';
   const quoteResult=await quote();
   if(!quoteResult)return;
   // La V1.1 n'a pas d'authentification client réelle ; ne jamais transformer
   // cette simulation en commande sans le compte exigé dans le cahier des charges.
   result.textContent='La réduction est reconnue, mais les commandes restent fermées jusqu’à l’activation des comptes clients sécurisés.';
  },true);
 }

 function enhance(){
  enhanceCarousel();
  enhanceCheckout();
  // La V1.1 publique reste une maquette de checkout : ne jamais afficher un
  // prix promotionnel qui ne serait pas également appliqué à la commande.
  if(document.querySelector('#app')?.dataset.checkoutConnected==='true')enhanceDiscounts();
 }
 async function boot(){
  try{
   const response=await fetch('/api/marketing',{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)return;
   const data=await response.json();
   slides=(Array.isArray(data.slides)?data.slides:[]).filter(s=>cleanUrl(s.mediaUrl));
   discounts=new Map((Array.isArray(data.discounts)?data.discounts:[]).map(d=>[d.productId,d]));
   // Même sans campagne, le formulaire de la V1.1 ne doit plus créer
   // de fausses commandes locales présentées comme réelles.
   enhance();
   let queued=false;
   const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})});
   observer.observe(document.body,{childList:true,subtree:true});
   window.addEventListener('hashchange',enhance);
  }catch(e){console.warn('Campagnes Jorsenshop indisponibles')}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
