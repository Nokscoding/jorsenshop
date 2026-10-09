(() => {
'use strict';
const $=(q,r=document)=>r.querySelector(q), $$=(q,r=document)=>[...r.querySelectorAll(q)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(n)||0)+' FC';
const login=$('#loginPanel'),panel=$('#staffPanel'),content=$('#staffContent'),nav=$('#staffNav');
let role=null,products=[],orders=[],editing=null,tab='';
const sizesDefault=['S','M','L','XL','XXL'];
async function api(path,options={}){
 const res=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});
 const data=await res.json().catch(()=>({error:'Réponse incorrecte'}));
 if(!res.ok)throw Error(data.error||'Opération impossible');
 return data;
}
function toast(message){const div=document.createElement('div');div.className='toast-item';div.textContent=message;$('#message').append(div);setTimeout(()=>div.remove(),5000)}
function setRole(r){
 role=r;login.hidden=!!r;panel.hidden=!r;$('#logout').hidden=!r;
 if(r==='admin'){tab='products';$('#staffLabel').textContent='GESTION BOUTIQUE';$('#staffTitle').textContent='Administration';}
 else{tab='finance';$('#staffLabel').textContent='ESPACE INVESTISSEUR';$('#staffTitle').textContent='Suivi des encaissements';}
 renderNav();if(r)changeTab(tab);
}
function renderNav(){
 nav.innerHTML=(role==='admin'?[['products','Produits & photos'],['orders','Commandes'],['finance','Rapports']]:[['finance','Suivi financier']])
  .map(([key,text])=>'<button type="button" data-tab="'+key+'" class="'+(tab===key?'active':'')+'">'+text+'</button>').join('');
 $$('[data-tab]',nav).forEach(btn=>btn.onclick=()=>changeTab(btn.dataset.tab));
}
async function changeTab(t){
 tab=t;editing=null;renderNav();content.innerHTML='<div class="loading">Chargement…</div>';
 try{
  if(t==='products'&&role==='admin'){products=(await api('/api/admin/products')).products;renderProducts();}
  if(t==='orders'&&role==='admin'){orders=(await api('/api/admin/orders')).orders;renderOrders();}
  if(t==='finance')renderFinance(await api('/api/investor/summary'));
 }catch(e){content.innerHTML='<div class="notice error">'+esc(e.message)+'</div>'}
}
function renderProducts(){
 if(editing){renderEditor();return}
 content.innerHTML='<div class="toolbar"><div><b>Catalogue</b><div class="muted">'+products.length+' produits (y compris les brouillons)</div></div><button id="newProduct" class="primary-button" type="button">+ Ajouter un produit</button></div>'+
 '<div class="staff-card staff-table-wrap"><table class="staff-table"><thead><tr><th>Photo</th><th>Produit</th><th>Prix</th><th>Couleurs</th><th>Statut</th><th>Action</th></tr></thead><tbody>'+
 products.map(p=>'<tr><td>'+(p.variants?.[0]?.images?.[0]?'<img class="table-avatar" src="'+esc(p.variants[0].images[0])+'" alt="">':'—')+
 '</td><td><strong>'+esc(p.name)+'</strong><small>'+esc(p.category)+'</small></td><td>'+money(p.priceFc)+'</td><td>'+p.variants.length+'</td><td>'+(p.isPublished?'Publié':'Brouillon')+'</td><td><button type="button" data-edit="'+esc(p.id)+'">Modifier</button></td></tr>').join('')+
 '</tbody></table>'+(products.length?'':'<p class="muted">Le catalogue est encore vide. Crée ton premier produit.</p>')+'</div>';
 $('#newProduct').onclick=()=>{editing={name:'',category:'Vêtements',priceFc:0,description:'',tag:'',sizes:[...sizesDefault],
   isPublished:false,pricesConfirmed:false,variants:[{color:'Noir',images:[],stock:Object.fromEntries(sizesDefault.map(s=>[s,0]))}]};renderEditor()};
 $$('[data-edit]',content).forEach(btn=>btn.onclick=()=>{const p=products.find(p=>p.id===btn.dataset.edit);editing=JSON.parse(JSON.stringify(p));renderEditor()});
}
function syncForm(){
 const f=$('#productForm');if(!f||!editing)return;
 const data=new FormData(f);
 editing.name=String(data.get('name')||'');editing.category=String(data.get('category')||'');
 editing.priceFc=Number(data.get('priceFc')||0);editing.description=String(data.get('description')||'');
 editing.tag=String(data.get('tag')||'');
 editing.sizes=String(data.get('sizes')||'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
 editing.pricesConfirmed=f.elements.pricesConfirmed.checked;
 editing.isPublished=f.elements.isPublished.checked;
 $$('.variant-box',f).forEach(box=>{
   const idx=Number(box.dataset.index),v=editing.variants[idx];if(!v)return;
   v.color=$('[data-color]',box).value;
   v.stock={};$$('input[data-size]',box).forEach(i=>v.stock[i.dataset.size]=Number(i.value)||0);
 });
}
function renderEditor(){
 if(!editing){renderProducts();return}
 const p=editing;
 content.innerHTML='<div class="toolbar"><button type="button" class="small-btn" id="backProducts">← Retour au catalogue</button><span class="muted">Les photos sont importées vers Cloudinary, jamais par lien externe.</span></div>'+
 '<div class="staff-card"><h2>'+(p.id?'Modifier le produit':'Créer un produit')+'</h2><form id="productForm"><div class="form-grid">'+
 '<label class="field">Nom du produit<input name="name" required minlength="2" maxlength="150" value="'+esc(p.name)+'"></label>'+
 '<label class="field">Catégorie<input name="category" required value="'+esc(p.category)+'"></label>'+
 '<label class="field">Prix (FC)<input name="priceFc" type="number" required min="0" step="1" value="'+(Number(p.priceFc)||0)+'"></label>'+
 '<label class="field">Étiquette<input name="tag" maxlength="100" placeholder="Nouveauté, Sélection..." value="'+esc(p.tag)+'"></label>'+
 '<label class="field wide">Description<textarea name="description" rows="3">'+esc(p.description)+'</textarea></label>'+
 '<label class="field wide">Tailles (séparées par des virgules)<input name="sizes" value="'+esc(p.sizes.join(', '))+'" placeholder="S, M, L, XL, XXL"></label></div>'+
 '<h3>Couleurs, images et stocks</h3><p class="muted">Chaque couleur reste une variante du même produit. Indique le stock par taille pour chaque couleur.</p>'+
 '<div id="variants">'+p.variants.map((v,i)=>renderVariant(v,i,p.sizes)).join('')+'</div>'+
 '<button type="button" id="addVariant" class="small-btn">+ Ajouter une couleur</button>'+
 '<div class="toggle-row"><label><input name="pricesConfirmed" type="checkbox" '+(p.pricesConfirmed?'checked':'')+'> Les prix sont définitifs</label>'+
 '<label><input name="isPublished" type="checkbox" '+(p.isPublished?'checked':'')+'> Publier dans la boutique</label></div>'+
 '<div class="notice">Pour publier, confirme les prix et renseigne au moins une image Cloudinary et une quantité de stock disponible. Les modifications sont sauvegardées dans Neon.</div>'+
 '<button class="primary-button" id="saveProduct" type="submit">Enregistrer le produit →</button></form></div>';
 $('#backProducts').onclick=()=>{editing=null;renderProducts()};
 $('#addVariant').onclick=()=>{syncForm();editing.variants.push({color:'Nouvelle couleur',images:[],stock:Object.fromEntries(editing.sizes.map(s=>[s,0]))});renderEditor()};
 $$('[data-remove-variant]',content).forEach(b=>b.onclick=()=>{syncForm();if(editing.variants.length<=1)return toast('Au moins une variante est nécessaire');editing.variants.splice(Number(b.dataset.removeVariant),1);renderEditor()});
 $$('[data-remove-image]',content).forEach(b=>b.onclick=()=>{syncForm();editing.variants[Number(b.dataset.variant)].images.splice(Number(b.dataset.removeImage),1);renderEditor()});
 $$('input[type="file"]',content).forEach(input=>input.onchange=async e=>{
   const idx=Number(input.dataset.uploadVariant),files=[...(e.target.files||[])];
   if(!files.length)return;syncForm();
   const state=$('[data-upload-state="'+idx+'"]');
   input.disabled=true;state.textContent='Envoi vers Cloudinary…';
   try{
     for(const file of files){
       if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)
         throw Error('Fichiers JPEG, PNG ou WebP de 10 Mo maximum');
       if(editing.variants[idx].images.length>=8)throw Error('Maximum 8 images par couleur');
       const signed=await api('/api/admin/media-sign',{method:'POST',body:'{}'});
       const formData=new FormData();
       formData.append('file',file);formData.append('api_key',signed.apiKey);
       formData.append('timestamp',String(signed.timestamp));formData.append('folder',signed.folder);
       formData.append('signature',signed.signature);
       const upload=await fetch('https://api.cloudinary.com/v1_1/'+encodeURIComponent(signed.cloudName)+'/image/upload',{method:'POST',body:formData});
       const data=await upload.json().catch(()=>({}));
       if(!upload.ok||!data.secure_url||!data.public_id?.startsWith('jorsenshop/catalog/'))throw Error(data?.error?.message||'Échec du transfert Cloudinary');
       editing.variants[idx].images.push(data.secure_url);
     }
     toast('Images importées sur Cloudinary');renderEditor();
   }catch(err){state.textContent=err.message;toast(err.message);input.disabled=false}
 });
 $('#productForm').onsubmit=async e=>{
   e.preventDefault();syncForm();const button=$('#saveProduct');button.disabled=true;button.textContent='Enregistrement…';
   try{
    const data=await api('/api/admin/products',{method:'POST',body:JSON.stringify(editing)});
    toast('Produit enregistré dans Neon');
    editing=null;products=(await api('/api/admin/products')).products;renderProducts();
   }catch(err){toast(err.message);button.disabled=false;button.textContent='Enregistrer le produit →'}
 };
}
function renderVariant(v,index,sizes){
 return '<div class="variant-box" data-index="'+index+'"><div class="variant-heading"><b>Couleur '+(index+1)+'</b>'+
 '<button type="button" class="small-btn" data-remove-variant="'+index+'">Supprimer cette couleur</button></div>'+
 '<label class="field">Nom de la couleur<input data-color required value="'+esc(v.color)+'" placeholder="Bleu marine, Noir, Beige..."></label>'+
 '<div class="variant-images">'+v.images.map((url,j)=>'<div><img src="'+esc(url)+'" alt="Photo '+(j+1)+'"><button type="button" aria-label="Retirer la photo" data-variant="'+index+'" data-remove-image="'+j+'">×</button></div>').join('')+'</div>'+
 '<label class="upload-btn">📤 Importer des images<input type="file" data-upload-variant="'+index+'" accept="image/jpeg,image/png,image/webp" multiple></label>'+
 '<span class="upload-state" data-upload-state="'+index+'"></span>'+
 '<h4>Stock disponible par taille</h4><div class="stocks-grid">'+sizes.map(s=>'<label>'+esc(s)+'<input data-size="'+esc(s)+'" type="number" min="0" max="100000" step="1" value="'+Number(v.stock?.[s]||0)+'"></label>').join('')+'</div></div>';
}
function renderOrders(){
 content.innerHTML='<div class="toolbar"><div><b>Commandes reçues</b><div class="muted">'+orders.length+' commandes enregistrées</div></div><button id="refreshOrders" class="small-btn">Actualiser</button></div>'+
 '<div class="staff-card staff-table-wrap"><table class="staff-table"><thead><tr><th>Référence</th><th>Client</th><th>Articles</th><th>Total</th><th>Statut</th><th>Paiement</th><th>Enregistrer</th></tr></thead><tbody>'+
 orders.map(o=>'<tr data-order="'+esc(o.order_number)+'"><td><b>'+esc(o.order_number)+'</b><small>'+new Date(o.created_at).toLocaleDateString('fr-FR')+'</small></td><td>'+
 esc(o.customer_name)+'<small>'+esc(o.customer_phone)+'</small><small>'+esc(o.delivery_address)+', '+esc(o.delivery_city)+'</small></td><td>'+
 (o.items||[]).map(i=>'<div>'+esc(i.name)+' · '+esc(i.color)+' · '+esc(i.size)+' ×'+Number(i.qty)+'</div>').join('')+'</td><td><strong>'+money(o.total)+'</strong></td>'+
 '<td><select data-status>'+[['a_confirmer','À confirmer'],['confirmee','Confirmée'],['en_preparation','En préparation'],['en_livraison','En livraison'],['livree','Livrée'],['annulee','Annulée']].map(([v,t])=>'<option value="'+v+'" '+(o.status===v?'selected':'')+'>'+t+'</option>').join('')+'</select></td>'+
 '<td>'+esc(o.payment_status)+'<label class="field"><input type="checkbox" data-paid '+(o.payment_status==='payee'?'checked disabled':'')+'> Confirmer encaissement</label></td>'+
 '<td><button type="button" data-save-order>Enregistrer</button></td></tr>').join('')+'</tbody></table></div>';
 $('#refreshOrders').onclick=()=>changeTab('orders');
 $$('[data-save-order]',content).forEach(btn=>btn.onclick=async()=>{
  const row=btn.closest('tr');btn.disabled=true;
  try{
   await api('/api/admin/orders',{method:'POST',body:JSON.stringify({orderNumber:row.dataset.order,status:$('[data-status]',row).value,paid:$('[data-paid]',row).checked})});
   toast('Commande mise à jour');changeTab('orders');
  }catch(e){toast(e.message);btn.disabled=false}
 });
}
function renderFinance(data){
 const totals=(data.monthly||[]).reduce((s,m)=>s+m.revenueFc,0);
 const expenses=(data.expenses||[]).reduce((s,e)=>s+e.amountFc,0);
 const latest=data.monthly?.[0];
 content.innerHTML='<div class="readonly-banner">Les montants proviennent des commandes réellement marquées « payées » par le gérant. Les frais de livraison sont exclus des ventes de produits. Aucun pourcentage de rémunération n’est appliqué sans accord signé.</div>'+
 '<div class="staff-grid"><div class="stat"><span>Ventes encaissées (12 derniers mois affichés)</span><b>'+money(totals)+'</b></div><div class="stat"><span>Dépenses enregistrées</span><b>'+money(expenses)+'</b></div><div class="stat"><span>Dernier mois encaissé</span><b>'+esc(latest?.month||'—')+'</b></div></div>'+
 '<div class="staff-card" style="margin-top:20px"><h2>Ventes mensuelles</h2><div class="staff-table-wrap"><table class="staff-table"><thead><tr><th>Mois</th><th>Commandes payées</th><th>Ventes articles</th></tr></thead><tbody>'+
 (data.monthly||[]).map(m=>'<tr><td>'+esc(m.month)+'</td><td>'+m.orders+'</td><td>'+money(m.revenueFc)+'</td></tr>').join('')+'</tbody></table></div>'+
 (data.monthly?.length?'':'<p class="muted">Aucune vente encaissée pour le moment.</p>')+'</div>'+
 '<div class="staff-card"><h2>Accords de rémunération signés</h2>'+(data.agreements?.length?data.agreements.map(a=>'<p>'+esc(a.name)+' · '+a.percentage+' % · '+esc(a.basis)+'</p>').join(''):'<p class="muted">Aucun accord signé enregistré. Aucune commission ne sera calculée automatiquement.</p>')+'</div>';
}
$('#loginForm').onsubmit=async e=>{
 e.preventDefault();$('#loginError').textContent='';const form=e.target,button=$('button[type="submit"]',form);
 button.disabled=true;
 try{
  const f=new FormData(form);const r=await api('/api/staff/login',{method:'POST',body:JSON.stringify({role:f.get('role'),password:f.get('password')})});
  form.reset();setRole(r.role);
 }catch(err){$('#loginError').textContent=err.message}
 finally{button.disabled=false}
};
$('#logout').onclick=async()=>{await api('/api/staff/session',{method:'POST',body:'{}'}).catch(()=>{});setRole(null)};
(async()=>{try{const r=await api('/api/staff/session');setRole(r.role||null)}catch{setRole(null)}})();
})();