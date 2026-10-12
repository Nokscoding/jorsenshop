/* Jorsenshop V1.1 — aperçu livreur uniquement. Aucune donnée de production. */
(() => {
  'use strict';
  if (window.JORSEN_PORTAL !== 'livreur') return;

  const KEY = 'jorsen_v1_';
  const escapeHTML = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = v => new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 0}).format(Number(v) || 0) + ' FC';
  const read = (name, fallback) => { try { return JSON.parse(localStorage.getItem(KEY + name)) ?? fallback; } catch { return fallback; } };

  const style = document.createElement('style');
  style.textContent = [
    '.js-driver-panel{margin:16px 0 24px;padding:17px;border:1px solid #dce5ef;border-radius:18px;background:linear-gradient(135deg,#f6faff,#eef5fb);color:#152940}',
    '.js-driver-panel strong{display:block;font-size:14px;margin:0 0 5px}',
    '.js-driver-panel p{font-size:12px;line-height:1.6;color:#627184;margin:0 0 11px}',
    '.js-driver-panel label{display:block;font-size:12px;font-weight:700}',
    '.js-driver-panel select{display:block;margin-top:7px;padding:11px 14px;max-width:100%;width:360px;border-radius:11px;border:1px solid #c5d2df;background:white;color:#152940;font-size:14px}',
    '.js-driver-details{margin-top:18px;padding:17px;border:1px solid #dce4ed;border-radius:15px;background:#f8fbfe;color:#213348}',
    '.js-driver-details .js-caption{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px;font-weight:800;font-size:14px}',
    '.js-driver-tag{padding:5px 9px;border-radius:999px;background:#e7eefb;color:#244e81;font-size:11px;font-weight:700}',
    '.js-driver-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 20px}',
    '.js-driver-fields .js-wide{grid-column:1/-1}',
    '.js-driver-fields span{display:block;font-size:11px;letter-spacing:.03em;text-transform:uppercase;color:#687c90;margin-bottom:4px}',
    '.js-driver-fields strong{display:block;font-size:14px;line-height:1.45;overflow-wrap:anywhere;color:#172d45}',
    '.js-driver-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}',
    '.js-driver-actions a,.js-driver-actions span{display:inline-flex;align-items:center;justify-content:center;min-height:40px;border-radius:10px;padding:8px 15px;font-size:13px;font-weight:700;text-decoration:none;border:1px solid #cfdbe8;color:#234d76;background:white}',
    '.js-driver-actions a:first-child{background:#173a60;color:white;border-color:#173a60}',
    '.js-driver-actions .is-demo{opacity:.65}',
    '.js-driver-note{font-size:12px;color:#6e8093;line-height:1.5;margin:13px 0 0}',
    '@media(max-width:600px){.js-driver-panel{margin:12px 0 18px}.js-driver-details{padding:14px}.js-driver-fields{grid-template-columns:1fr}.js-driver-fields .js-wide{grid-column:1}.js-driver-actions>*{flex:1;min-width:125px}}'
  ].join('\n');
  document.head.append(style);

  const orderList = () => { const rows = read('orders', []); return Array.isArray(rows) ? rows : []; };

  function previewSelector(main, orders) {
    if (main.querySelector('#js-driver-preview')) return;
    const names = [...new Set(orders.map(o => (o.driver || '').trim()).filter(Boolean))].sort();
    const current = read('demoCurrentDriver', 'Livreur démo');
    if (current && !names.includes(current)) names.unshift(current);
    const panel = document.createElement('section');
    panel.id = 'js-driver-preview';
    panel.className = 'js-driver-panel';
    const choices = names.map(name => '<option value="' + escapeHTML(name) + '"' + (name === current ? ' selected' : '') + '>' + escapeHTML(name) + '</option>').join('');
    panel.innerHTML = '<strong>Livraisons attribuées par le gérant</strong>' +
      '<p>Maquette de démonstration : seules les missions du livreur sélectionné sont affichées. L’identification sécurisée et la synchronisation entre appareils seront ajoutées à la V2.</p>' +
      '<label for="js-driver-choice">Livreur (test)<select id="js-driver-choice">' + choices + '</select></label>';
    const heading = main.querySelector('h1');
    if (heading) heading.insertAdjacentElement('afterend', panel);
    else main.prepend(panel);
    const selector = panel.querySelector('select');
    selector.addEventListener('change', () => {
      localStorage.setItem(KEY + 'demoCurrentDriver', JSON.stringify(selector.value));
      window.dispatchEvent(new Event('hashchange'));
    });
  }

  function details(o) {
    const customer = escapeHTML(o.customer || 'Nom indisponible');
    const phone = String(o.phone || '').trim();
    const address = String(o.address || '').trim();
    const notes = String(o.notes || '').trim();
    const demo = !!o.demo;
    const digits = phone.replace(/[^\d+]/g, '');
    const callable = !demo && /^\+?[0-9]{7,15}$/.test(digits);
    const locatable = !demo && address.length >= 6;
    const nameLabel = (o.driver || '').trim();
    const lines = (o.items || []).map(item => {
      const product = (window.JORSEN_CATALOG || []).find(p => p.id === item.productId);
      return escapeHTML((product?.name || 'Article') + ' × ' + (item.qty || 1) + (item.size ? ' · Taille ' + item.size : ''));
    }).join('<br>') || 'Détails du colis à confirmer';
    const cash = o.payment === 'Payée' ? 'Déjà payé' : money(o.total);
    const tag = o.status === 'En livraison' ? 'Colis remis au livreur' : (o.status === 'Livrée' ? 'Livraison terminée' : 'En attente de remise par le gérant');
    const actions =
      (callable ? '<a href="tel:' + escapeHTML(digits) + '" aria-label="Appeler le client">☎ Appeler</a>' : '<span class="is-demo" title="Coordonnées de démonstration">☎ Appeler (démo)</span>') +
      (locatable ? '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address) + '" target="_blank" rel="noopener noreferrer">⌖ Itinéraire</a>' : '<span class="is-demo">⌖ Itinéraire (démo)</span>');
    return '<section class="js-driver-details" aria-label="Informations de livraison">' +
      '<div class="js-caption">Informations de livraison <span class="js-driver-tag">' + escapeHTML(tag) + '</span></div>' +
      '<div class="js-driver-fields">' +
      '<div><span>Client</span><strong>' + customer + '</strong></div>' +
      '<div><span>Numéro de téléphone</span><strong>' + escapeHTML(phone || 'Non renseigné') + '</strong></div>' +
      '<div class="js-wide"><span>Adresse complète</span><strong>' + escapeHTML(address || 'Non renseignée') + '</strong></div>' +
      '<div class="js-wide"><span>Articles à remettre</span><strong>' + lines + '</strong></div>' +
      '<div><span>Encaissement prévu</span><strong>' + escapeHTML(cash) + '</strong></div>' +
      '<div><span>Livreur affecté</span><strong>' + escapeHTML(nameLabel) + '</strong></div>' +
      (notes ? '<div class="js-wide"><span>Instructions du client</span><strong>' + escapeHTML(notes) + '</strong></div>' : '') +
      '</div><div class="js-driver-actions">' + actions + '</div>' +
      '<p class="js-driver-note">Le gérant confirme et prépare la commande avant sa remise. Le livreur n’a pas à collecter les commandes de la boutique.</p>' +
      '</section>';
  }

  function enhance() {
    const app = document.querySelector('#app');
    const main = app?.querySelector('main');
    if (!main) return;
    const orders = orderList();
    previewSelector(main, orders);
    const assignedName = read('demoCurrentDriver', 'Livreur démo');
    main.querySelectorAll('article').forEach(card => {
      if (card.querySelector('.js-driver-details')) return;
      const heading = card.querySelector('h3');
      const orderId = (heading?.textContent || '').match(/\bJS-(?:DEMO-)?[A-Z0-9-]+\b/)?.[0];
      if (!orderId) return;
      const order = orders.find(o => o.id === orderId && o.driver === assignedName);
      if (!order) return;
      card.insertAdjacentHTML('beforeend', details(order));
    });
  }

  const app = document.querySelector('#app');
  if (!app) return;
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; enhance(); });
  });
  observer.observe(app, {childList: true, subtree: true});
  enhance();
})();