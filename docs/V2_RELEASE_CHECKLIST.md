# JorsenShop V2 — État réel et validation avant publication

Mise à jour : 12 octobre 2026. **Cette branche est en développement, pas une production prête à encaisser.**

## Règles commerciales validées

- Boutique indépendante à gérant unique, pas une marketplace ni vendeurs tiers.
- Conserver le design V1.1 des 4 interfaces : boutique, gérant, investisseur et livreur.
- Clients : choix de ville OBLIGATOIRE avant consultation de la boutique ; compte email/mot de passe FACULTATIF. Tous peuvent parcourir, remplir le panier et commander comme invité.
- Invités : coordonnées de réception à chaque commande ; reçu avec numéro et jeton confidentiel pour suivre la commande et écrire au gérant depuis le même navigateur.
- Clients inscrits : historique lié au compte et retrouvé sur plusieurs appareils ; les reçus invités ne sont pas transférés automatiquement à un compte.
- Professionnels : Neon Auth et rôle attribué explicitement, sans promotion automatique d'un client.
- Lubumbashi : normale 7 000 FC ou express 15 000 FC, règlement à réception.
- Likasi, Fungurume, Kolwezi : expédition 10 000 FC, règlement Airtel Money ou Orange Money **avant achat/emballage/expédition** via KKS ou NGOKAF.
- Commandes : attente, confirmée, préparation, prête, livraison/expédiée, livrée, annulée/échec.
- Notification persistante par commande et conversation liée à la commande.
- Le gérant confirme, prépare et affecte. Le livreur ne voit que ses missions personnelles.
- Le gérant peut administrer produits, variantes, stocks, catégories et prix.
- Cloudinary : 278 photos vérifiées (000–277, y compris 098 retrouvée), CDN optimisé jusqu'à 1600 px.
- Produit js-001 renommé Pull quarter-zip torsadé dans Neon développement et le build V2.

## Modifications réalisées (développement uniquement)

- Branche GitHub : feature/jorsenshop-v2-foundations.
- Neon projet long-union-90591291 ; branche de développement br-broad-haze-b5w5wceo ; base jorsenshop.
- Neon Auth activé sur la branche de développement, pas en production.
- Migrations SQL 005, 006, 007 exécutées dans cette branche et versionnées dans GitHub.
- Nouvelle API versionnée sous api/v2 et deux scripts UI progressifs site/v2-client.js et site/v2-staff.js.
- Interface validée V1.1 reconstruite par scripts/build-approved-v11-from-git.mjs, puis enrichie sans refaire son thème.
- La base Neon production, la branche main et le déploiement Vercel public restent inchangés.

## Préparation Vercel et configuration

Renseigner dans Vercel au bon environnement (preview vers Neon développement, production après migration) :
- DATABASE_URL, connexion PostgreSQL correspondant à la branche.
- NEON_AUTH_BASE_URL, URL Neon Auth de la branche terminant par /auth.
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
- SESSION_SECRET si nécessaire pour le rate-limit du socle existant.

Ne jamais placer des secrets dans le code GitHub ni dans le navigateur.

Ajouter l'URL exacte de prévisualisation aux origines autorisées dans Neon Auth de développement.

## Comptes professionnels

Inscrire d'abord le premier administrateur sur Neon Auth ; puis lui attribuer manuellement le rôle admin dans v2_user_roles depuis un accès Neon sécurisé. Aucun compte client ne reçoit ce rôle automatiquement. Ensuite les administrateurs et gérants autorisés peuvent attribuer les autres rôles avec l'API sécurisée.

## Blocages réels avant ouverture publique

1. Recevoir du gérant les numéros Airtel Money/Orange Money et le bénéficiaire exact pour les paiements préalables.
2. Les 73 produits sont visibles dans Neon développement avec leurs prix courants (fictifs, modifiables librement par le gérant), sans validation des prix préalable. Aucun stock n'est disponible à ce stade : le gérant doit renseigner les quantités avant des ventes réelles.
3. Tester les cookies Neon Auth et Vercel pour les comptes volontaires et professionnels ; confirmer surtout qu'aucun compte n'est requis pour accéder à la boutique ni pour acheter.
4. Tester le choix obligatoire des 4 villes, l'achat invité, le reçu privé, la messagerie invitée, l'inscription facultative, les permissions, les paiements, les notifications et les livraisons sur iPhone/PC.
5. Mettre en place les notifications push si des alertes sont voulues lorsque le site est fermé (à ce stade notifications persistantes + vérification périodique en application).
6. Compléter la réinitialisation de mot de passe, les retours/annulations, les remises d'argent des livreurs et leur rapprochement.
7. Revoir la sécurité, préparer migration 005–007 vers production après validation et tester rollback.
8. Publier une seule fois depuis un commit validé, et non à chaque modification.

## État vérifié

- Analyse syntaxique JS V2 : passées.
- Frais des cinq modes : tests directs réussis.
- Neon développement : 4 villes, 5 modes, 9 catégories, SQL V2 créé.
- Cloudinary : 278 images présentes.
- CI GitHub : un contrôle automatisé n'a pas exécuté ses étapes correctement et remonte un échec. Cela ne vaut pas validation du build.
- Tests d'intégration dans le navigateur : pas encore réalisés.
- Déploiement : aucun nouveau déploiement Vercel autorisé/effectué.

La V2 ne doit pas être déclarée finale tant que l'authentification et le parcours de commande réel n'ont pas passé les tests.

## Décision commerciale : tarifs de démarrage

Les 73 articles sont affichés dans le catalogue de développement avec leur prix actuel. Aucun workflow de confirmation des prix n'est exigé : le gérant modifie les noms, catégories et montants lorsqu'il le souhaite. La publication est indépendante de ce drapeau. Les quantités de stock et la vérification des commandes restent contrôlées pour éviter la vente de produits indisponibles. Migration SQL 008 exécutée uniquement sur Neon développement.
