# Jorsenshop — Promotions et carrousel administrable (octobre 2026)

## Fonctionnalités
- Admin sécurisé sur `/staff.html` > **Promotions & carrousel**.
- Slides : importer une photo via Cloudinary `jorsenshop/promotions`, modifier titre, surtitre, description, bouton, destination SPA, ordre, activation et calendrier.
- Remises par produit : pourcentage (1 à 95 %) ou montant fixe en francs congolais, dates début/fin et activation.
- Codes promo : création (A-Z / 0-9 / tiret / underscore), pourcentage ou montant fixe, minimum d'achat, limite d'utilisations, activation et durée.
- Site V1.1 : les campagnes actives remplacent les slides **du carrousel d'origine**, sans modifier l'archive V1.1. Sans campagne, l'ancien carrousel est inchangé.
- API Neon : `GET /api/marketing`, `POST /api/quote`, `POST /api/orders` (promoCode facultatif) et API privée `/api/admin/marketing`.
- Le serveur calcule les remises et consomme les coupons dans la transaction de commande, sous verrou PostgreSQL, afin de ne jamais accepter un montant choisi par le navigateur.

## Mise en place
1. **Ne pas déployer sur main avant migration**. Sauvegarder la base Jorsenshop Neon, puis exécuter `db/migrations/005_promotions.sql` sur **sa base dédiée**, après les migrations 001–004.
2. Vérifier les identifiants admin existants et les variables Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).
3. Fusionner le code de la branche promotions, puis tester la connexion à `/staff.html` et enregistrer une bannière de test inactive. Tester photo, périodes, activation et suppression. Vérifier ensuite le carrousel de `/#/`.
4. Tester un produit publié avec prix confirmé et stock : code promo valide/expiré, minimum d'achat, plafond d'utilisation et cumul remise produit + coupon. Le total commandé dans Neon doit correspondre au total retourné par l'API. Contrôler aussi le rapport financier (ventes nettes des remises).

## Limite de la V1.1 publique à ne pas masquer
L'interface originale V1.1 restaurée par le build est encore une maquette locale pour les commandes, et n'appelle pas le checkout Neon. La barre promotionnelle et le carrousel sont raccordés à Neon, mais **un code promo ne doit pas être présenté comme encaissé dans le checkout de cette maquette**. Le formulaire avec vérification du code est câblé dans `site/shop.js` (l'interface transitoire), pas dans l'original V1.1 archivé. Avant le vrai lancement, raccorder **le checkout V1.1 validé** à `/api/quote` et `/api/orders` sans changer la présentation approuvée.

## Règles
- Une remise active au maximum par produit. Les promotions produits et coupons se cumulent : le code s'applique au sous-total après la remise produit.
- Sans date de fin, campagne valable jusqu'à désactivation manuelle. Pas de glissement automatique du calendrier.
- Les codes invalides ou épuisés sont rejetés côté serveur au checkout.
- La limite d'utilisation est consommée dès la création de la commande (paiement à la livraison), pas à l'encaissement. Elle n'est pas rétablie automatiquement en cas d'annulation.
- Aucun code de Noël n'est activé par défaut : le gérant choisit les montants, les visuels et les dates.
