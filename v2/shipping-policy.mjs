/*
 * JorsenShop V2 — conditions commerciales validées le 12 octobre 2026.
 * Source unique de vérité pour les calculs serveur (jamais les montants du navigateur).
 * RDC : montants en francs congolais entiers.
 */
export const CITIES = Object.freeze({
  lubumbashi: Object.freeze({label:'Lubumbashi',type:'local',active:true}),
  likasi: Object.freeze({label:'Likasi',type:'expedition',active:true}),
  fungurume: Object.freeze({label:'Fungurume',type:'expedition',active:true}),
  kolwezi: Object.freeze({label:'Kolwezi',type:'expedition',active:true})
});
export const SHIPPING_FEES_FC = Object.freeze({normal:7000,express:15000,expedition:10000});
export const EXPRESS_AGENCIES = Object.freeze(['KKS','NGOKAF']);
export const ORDER_STATUSES = Object.freeze([
  'en_attente','confirmee','en_preparation','prete_a_livrer','en_livraison',
  'expediee','livree','annulee','echec_livraison'
]);
export const LABELS = Object.freeze({
  en_attente:'Commande en attente',
  confirmee:'Commande confirmée',
  en_preparation:'En préparation',
  prete_a_livrer:'Prête à livrer',
  en_livraison:'En cours de livraison',
  expediee:'Colis expédié',
  livree:'Livré',
  annulee:'Annulée',
  echec_livraison:'Livraison non effectuée'
});
export function normalizeCity(input) {
  const n=String(input||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return Object.hasOwn(CITIES,n)?n:null;
}
export function shippingQuote(inputCity,requestedMode) {
  const key=normalizeCity(inputCity);
  if(!key||!CITIES[key].active) throw new RangeError('Ville non desservie');
  const city=CITIES[key];
  const mode=requestedMode==null||requestedMode===''?
    (city.type==='local'?'normal':'expedition'):String(requestedMode).toLowerCase();
  const allowed=city.type==='local'?['normal','express']:['expedition'];
  if(!allowed.includes(mode)) throw new RangeError('Livraison indisponible pour cette ville');
  return {
    city:key,cityLabel:city.label,mode,
    modeLabel:mode==='normal'?'Livraison normale':mode==='express'?'Livraison express':'Expédition interurbaine',
    deliveryFeeFc:SHIPPING_FEES_FC[mode],
    paymentRequiredBeforePurchase:city.type==='expedition',
    paymentRequiredBeforeShipping:city.type==='expedition',
    paymentMethods:city.type==='local'?['paiement_livraison']:['airtel_money','orange_money'],
    agencies:city.type==='expedition'?[...EXPRESS_AGENCIES]:[],
    requiresManagerPaymentVerification:city.type==='expedition',
    instructions:city.type==='local'?
      'Le gérant prépare le colis puis l’attribue au livreur. Paiement à la réception.':
      'Payer par Airtel Money ou Orange Money. Après vérification par le gérant, achat, emballage et expédition via une agence.'
  };
}
export function publicCities(){
  return Object.entries(CITIES).filter(([,c])=>c.active).map(([key,c])=>({
    id:key,name:c.label,mode:c.type,deliveryOptions:c.type==='local'?[
      {id:'normal',feeFc:SHIPPING_FEES_FC.normal},
      {id:'express',feeFc:SHIPPING_FEES_FC.express}
    ]:[{id:'expedition',feeFc:SHIPPING_FEES_FC.expedition}]
  }));
}
