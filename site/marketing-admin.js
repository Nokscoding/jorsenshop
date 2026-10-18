(function initMarketingAdmin(){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
 const fmt=n=>new Intl.NumberFormat('fr-FR').format(Number(n)||0)+' FC';
 const when=iso=>iso?new Date(new Date(iso).getTime()-new Date(iso).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
 const check=(v)=>v?'checked':'';
 const inputTime=(title,name,value)=>`<label class="field">${title}<input name="${name}" type="datetime-local" value="${esc(when(value))}"></label>`;
 const payloadTime=value=>value?new Date(value).toISOString():null;
 let state={slides:[],discounts:[],coupons:[],products:[]},root,slideEdit=null,discountEdit=null,couponEdit=null,uploaded='';
 async function call(path,options={}){
  const r=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});
  const b=await r.json().catch(()=>({error:'Réponse invalide'}));
  if(!r.ok)throw Error(b.error||'Opération impossible');
  return b;
 }
 function notice(message,bad=false){
  const n=root.querySelector('#marketingNotice');if(n){n.textContent=message;n.hidden=false;n.className='notice'+(bad?' error':'');}
 }
 function formBase(kind,value){
  return `<label class="field">Type de réduction<select name="kind"><option value="percent" ${kind==='percent'?'selected':''}>Pourcentage (%)</option><option value="fixed" ${kind==='fixed'?'selected':''}>Montant fixe (FC)</option></select></label>
   <label class="field">Valeur<input name="value" type="number" min="1" step="1" required value="${Number(value)||10}"></label>`;
 }
 async function refresh(){
  state=await call('/api/admin/marketing');
  renderUI();
 }
 function renderUI(){
  if(!root)return;
  const s=slideEdit||{eyebrow:'OFFRE SPÉCIALE',headline:'',description:'',cta:'Découvrir',destination:'#catalogue',position:0,active:true};
  const d=discountEdit||{kind:'percent',value:10,active:true};
  const c=couponEdit||{kind:'percent',value:10,min_subtotal_fc:0,active:true};
  uploaded=s.media_url||'';
  root.innerHTML=`
   <div id="marketingNotice" class="notice" hidden></div>
   <div class="staff-card"><div class="toolbar"><div><h2>Carrousel de la boutique</h2><p class="muted">Change les photos et les textes sans modifier le code. Active et programme chaque campagne.</p></div><button type="button" class="small-btn" id="resetSlide">+ Nouvelle bannière</button></div>
   <div class="campaign-grid">${state.slides.map(x=>`<article class="campaign-card"><img src="${esc(x.media_url)}" alt=""><div><b>${esc(x.headline)}</b><p class="muted">${esc(x.description)}</p><small>${x.active?'Active':'Désactivée'} · ordre ${Number(x.position)||0}</small><div class="campaign-actions"><button type="button" data-slide-edit="${esc(x.id)}">Modifier</button><button type="button" data-remove="slide" data-id="${esc(x.id)}">Supprimer</button></div></div></article>`).join('')||'<p class="muted">Aucune bannière enregistrée.</p>'}</div>
   <h3>${slideEdit?'Modifier la bannière':'Ajouter une bannière'}</h3>
   <form id="slideForm"><div class="form-grid">
    <label class="field wide">Image de campagne (JPEG, PNG ou WebP, 10 Mo max)
      <input id="slideFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
    <div class="wide" id="slidePreview">${uploaded?`<img class="campaign-preview" src="${esc(uploaded)}" alt="Aperçu">`:''}</div>
    <label class="field">Petit texte au-dessus du titre<input name="eyebrow" maxlength="70" value="${esc(s.eyebrow)}" placeholder="NOËL CHEZ JORSENSHOP"></label>
    <label class="field">Titre de l’offre<input name="headline" maxlength="140" required value="${esc(s.headline)}" placeholder="La magie de Noël arrive"></label>
    <label class="field wide">Description<textarea name="description" maxlength="300" rows="2">${esc(s.description)}</textarea></label>
    <label class="field">Texte du bouton<input name="cta" maxlength="50" value="${esc(s.cta)}"></label>
    <label class="field">Destination du bouton<input name="destination" maxlength="180" value="${esc(s.destination)}" placeholder="/#catalogue"></label>
    <label class="field">Ordre d’affichage<input type="number" name="position" min="-1000" max="1000" value="${Number(s.position)||0}"></label>
    ${inputTime('Début (optionnel)','startsAt',s.starts_at)}
    ${inputTime('Fin (optionnel)','endsAt',s.ends_at)}
    <label class="toggle-row"><input type="checkbox" name="active" ${check(s.active)}> Afficher cette bannière</label>
    </div><button type="submit" class="primary-button">Enregistrer la bannière →</button></form>
   </div>
   <div class="staff-card"><div class="toolbar"><div><h2>Réductions sur les produits</h2><p class="muted">Prix barré et prix réduit affichés pour les produits publiés. Une remise par produit, cumulable avec un code promo.</p></div><button type="button" class="small-btn" id="resetDiscount">+ Nouvelle remise</button></div>
   <div class="staff-table-wrap"><table class="staff-table"><thead><tr><th>Produit</th><th>Remise</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
   ${state.discounts.map(x=>`<tr><td>${esc(state.products.find(p=>p.id===x.product_id)?.name||x.product_id)}</td><td>${Number(x.value)} ${x.kind==='percent'?'%':'FC'}</td><td>${x.active?'Active':'Inactive'}</td><td><button data-discount-edit="${esc(x.product_id)}">Modifier</button> <button data-remove="discount" data-id="${esc(x.product_id)}">Retirer</button></td></tr>`).join('')}</tbody></table></div>
   <form id="discountForm"><div class="form-grid"><label class="field wide">Produit<select name="productId" required>${state.products.map(p=>`<option value="${esc(p.id)}" ${p.id===d.product_id?'selected':''}>${esc(p.name)} · ${fmt(p.price_fc)}</option>`).join('')}</select></label>
   ${formBase(d.kind,d.value)}
   ${inputTime('Début (optionnel)','startsAt',d.starts_at)}
   ${inputTime('Fin (optionnel)','endsAt',d.ends_at)}
   <label class="toggle-row"><input type="checkbox" name="active" ${check(d.active)}> Réduction active</label></div>
   <button type="submit" class="primary-button" ${state.products.length?'':'disabled'}>Enregistrer la remise →</button></form></div>
   <div class="staff-card"><div class="toolbar"><div><h2>Codes promo</h2><p class="muted">Crée des codes avec montant, date de validité, minimum d’achat et nombre maximum d’utilisations.</p></div><button type="button" class="small-btn" id="resetCoupon">+ Nouveau code</button></div>
   <div class="staff-table-wrap"><table class="staff-table"><thead><tr><th>Code</th><th>Remise</th><th>Utilisations</th><th>État</th><th>Actions</th></tr></thead><tbody>
   ${state.coupons.map(x=>`<tr><td><b>${esc(x.code)}</b></td><td>${Number(x.value)} ${x.kind==='percent'?'%':'FC'}</td><td>${Number(x.uses_count)} / ${x.max_uses??'∞'}</td><td>${x.active?'Actif':'Désactivé'}</td><td><button data-coupon-edit="${esc(x.code)}">Modifier</button> <button data-remove="coupon" data-id="${esc(x.code)}">Désactiver</button></td></tr>`).join('')}</tbody></table></div>
   <form id="couponForm"><div class="form-grid">
   <label class="field wide">Code à saisir lors du paiement<input name="code" required minlength="4" maxlength="32" pattern="[A-Za-z0-9_-]{4,32}" style="text-transform:uppercase" value="${esc(c.code||'')}" placeholder="NOEL20" ${couponEdit?'readonly':''}></label>
   ${formBase(c.kind,c.value)}
   <label class="field">Minimum d’achats (FC)<input type="number" name="minSubtotalFc" min="0" step="1" value="${Number(c.min_subtotal_fc)||0}"></label>
   <label class="field">Nombre max d’utilisations (vide = illimité)<input type="number" name="maxUses" min="1" step="1" value="${c.max_uses??''}"></label>
   ${inputTime('Début (optionnel)','startsAt',c.starts_at)}
   ${inputTime('Fin (optionnel)','endsAt',c.ends_at)}
   <label class="toggle-row"><input type="checkbox" name="active" ${check(c.active)}> Code actif</label></div>
   <button type="submit" class="primary-button">Enregistrer le code promo →</button></form></div>`;
  root.querySelector('#resetSlide').onclick=()=>{slideEdit=null;renderUI()};
  root.querySelector('#resetDiscount').onclick=()=>{discountEdit=null;renderUI()};
  root.querySelector('#resetCoupon').onclick=()=>{couponEdit=null;renderUI()};
  root.querySelectorAll('[data-slide-edit]').forEach(b=>b.onclick=()=>{slideEdit=state.slides.find(x=>x.id===b.dataset.slideEdit);renderUI()});
  root.querySelectorAll('[data-discount-edit]').forEach(b=>b.onclick=()=>{discountEdit=state.discounts.find(x=>x.product_id===b.dataset.discountEdit);renderUI()});
  root.querySelectorAll('[data-coupon-edit]').forEach(b=>b.onclick=()=>{couponEdit=state.coupons.find(x=>x.code===b.dataset.couponEdit);renderUI()});
  root.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{
   if(!confirm('Confirmer cette action ?'))return;
   try{await call('/api/admin/marketing',{method:'POST',body:JSON.stringify({action:'remove',kind:b.dataset.remove,id:b.dataset.id})});await refresh();notice('Modification enregistrée')}
   catch(e){notice(e.message,true)}
  });
  root.querySelector('#slideFile').onchange=async e=>{
   const file=e.target.files?.[0];if(!file)return;
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)return notice('Image JPEG, PNG ou WebP de 10 Mo maximum',true);
   e.target.disabled=true;notice('Import de l’image sur Cloudinary…');
   try{
    const s=await call('/api/admin/media-sign',{method:'POST',body:JSON.stringify({purpose:'carousel'})});
    const data=new FormData();
    data.append('file',file);data.append('api_key',s.apiKey);data.append('timestamp',String(s.timestamp));
    data.append('folder',s.folder);data.append('overwrite','false');data.append('signature',s.signature);
    const r=await fetch('https://api.cloudinary.com/v1_1/'+encodeURIComponent(s.cloudName)+'/image/upload',{method:'POST',body:data});
    const body=await r.json();if(!r.ok||!body.secure_url||!body.public_id?.startsWith('jorsenshop/promotions/'))throw Error(body.error?.message||'Import échoué');
    uploaded=body.secure_url;
    root.querySelector('#slidePreview').innerHTML='<img class="campaign-preview" alt="Aperçu" src="'+esc(uploaded)+'">';
    notice('Image chargée. Pense à enregistrer la bannière.');
   }catch(e){notice(e.message,true)}finally{e.target.disabled=false}
  };
  root.querySelector('#slideForm').onsubmit=async e=>{
   e.preventDefault();const f=e.target,v=new FormData(f);
   if(!uploaded)return notice('Ajoute une photo au carrousel',true);
   const body={action:'slide',id:slideEdit?.id,mediaUrl:uploaded,
    eyebrow:v.get('eyebrow'),headline:v.get('headline'),description:v.get('description'),cta:v.get('cta'),
    destination:v.get('destination'),position:Number(v.get('position')),active:f.elements.active.checked,
    startsAt:payloadTime(v.get('startsAt')),endsAt:payloadTime(v.get('endsAt'))};
   try{await call('/api/admin/marketing',{method:'POST',body:JSON.stringify(body)});slideEdit=null;await refresh();notice('Bannière enregistrée')}
   catch(err){notice(err.message,true)}
  };
  root.querySelector('#discountForm').onsubmit=async e=>{
   e.preventDefault();const f=e.target,v=new FormData(f);
   const body={action:'discount',productId:v.get('productId'),kind:v.get('kind'),value:Number(v.get('value')),
    active:f.elements.active.checked,startsAt:payloadTime(v.get('startsAt')),endsAt:payloadTime(v.get('endsAt'))};
   try{await call('/api/admin/marketing',{method:'POST',body:JSON.stringify(body)});discountEdit=null;await refresh();notice('Réduction enregistrée')}
   catch(err){notice(err.message,true)}
  };
  root.querySelector('#couponForm').onsubmit=async e=>{
   e.preventDefault();const f=e.target,v=new FormData(f);
   const body={action:'coupon',code:v.get('code'),kind:v.get('kind'),value:Number(v.get('value')),
    minSubtotalFc:Number(v.get('minSubtotalFc')),maxUses:v.get('maxUses')||null,
    active:f.elements.active.checked,startsAt:payloadTime(v.get('startsAt')),endsAt:payloadTime(v.get('endsAt'))};
   try{await call('/api/admin/marketing',{method:'POST',body:JSON.stringify(body)});couponEdit=null;await refresh();notice('Code promo enregistré')}
   catch(err){notice(err.message,true)}
  };
 }
 window.JorsenMarketingAdmin={
  async render(el){root=el;root.innerHTML='<div class="loading">Chargement des campagnes…</div>';await refresh();}
 };
})();
