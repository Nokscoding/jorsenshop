# Jorsenshop

Site de vêtements Jorsenshop. Projet indépendant de NKS Services et de One Market.

## État vérifié au 9 octobre 2026

- **Visuel V1.1 mobile-first approuvé RESTAURÉ en production** sur https://jorsenshop.vercel.app/.
- **Sources originales préservées intégralement dans GitHub** sous `original-v11/` (gzip/base64) ; le script `scripts/build-approved-v11-from-git.mjs` rétablit les fichiers après validation SHA-256, **sans téléchargement Drive ni changement du design**.
- **Cloudinary Jorsenshop dédié :** `jrgtsxkt`. 277 des 278 photos produits hébergées sous `jorsenshop/catalog/`. Logo et deux vidéos lookbook sur Cloudinary également ; la photo `098.webp` reste temporairement sur une ancienne URL Vercel vérifiée.
- **Neon :** base PostgreSQL `jorsenshop` entièrement distincte, migrations `001–006`. Test public `GET /api/health` vérifié : `{"ok":true,"database":"connected"}`.
- **Vercel :** projet `jorsenshop` connecté à `Nokscoding/jorsenshop`. Build `node scripts/build-approved-v11-from-git.mjs`, output `site/`.

## Important : V1.1 toujours MAQUETTE pour les transactions

L'interface restaurée contient des **commandes et chiffres fictifs** utilisant localStorage dans le navigateur. Les espaces maquette (gérant / investisseur) ne sont pas encore raccordés aux tables PostgreSQL et **ne constituent pas une interface de production sécurisée**, malgré leurs URL distinctes.

Les fonctions Neon séparées existent sous `api/` pour gestion des produits, commandes sans compte, lecture investisseur et import signé des images Cloudinary. Elles doivent être intégrées dans **les mêmes écrans V1.1 approuvés, sans changer leur apparence**, après intégration de l'authentification des comptes et de la gestion des stocks.

**Ne pas prendre de commandes réelles ou marquer des paiements dans les maquettes** avant la connexion authentifiée aux API. Les 73 prix initiaux sont des montants provisoires libres, modifiables sans case de confirmation depuis l'administration ; ils sont enregistrés dans Neon. Les partages financiers ne sont calculables qu'après accord commercial signé.

## Tarification (18 octobre 2026)

- Les 73 produits disposent de prix d'exemple en FC (45 000 à 245 000), déjà enregistrés sur Neon production.
- Aucun circuit de validation de prix : l'administrateur peut éditer les tarifs librement. Les produits modifiés quittent automatiquement l'état « prix provisoire ».
- Les valeurs de la base sont affichées dans la boutique grâce au raccordement de la V1.1 par `marketing-storefront.js` (après publication du code).
- Cette liberté tarifaire ne remplace pas la sécurité des comptes clients ni l'intégration des vraies commandes.

## Organisation

- `original-v11/` : instantané fidèle du visuel validé (fichiers d'origine compressés).
- `scripts/build-approved-v11-from-git.mjs` : reconstruction fidèle + URLs médias Cloudinary.
- `api/` : API sécurisée en cours d'intégration.
- `db/migrations/` : schéma Neon et opérations transactionnelles.
- `site/` : ancien socle source et interfaces transitoires, écrasés au build par V1.1 pour les fichiers approuvés.
- `docs/ORIGINAL_APPROVED_SOURCE.md` : détails de conservation des fichiers approuvés.

**Aucune dépendance à l'ancien archive Drive temporaire au build de production.**
