# Jorsenshop — Vercel + Neon PostgreSQL

**Jorsenshop** est une boutique de vêtements indépendante de NKS Services et de One Market.

## Statut (octobre 2026)

- **GitHub** : `Nokscoding/jorsenshop` (branche `main`).
- **Vercel** : projet `jorsenshop` lié à GitHub ; déploiements automatiques après chaque push.
- **Neon** : projet `jorsenshop`, branche `production`, base `jorsenshop`.
- **DATABASE_URL** : configuré comme variable **chiffrée** dans le projet Vercel. Ne jamais mettre cette valeur dans Git.
- **Schéma PostgreSQL** : migration `db/migrations/001_initial.sql` exécutée, 15 tables et une vue.
- **API Vercel** : `api/health.js`, `api/products.js`, `api/products/[id].js`.
- **Boutique V1.1 mobile-first** : interfaces validées, mais la version complète et les médias doivent encore être importés dans `site/`. Le fichier `site/index.html` est une page temporaire.

Les paiements, commandes, comptes, messagerie, permissions d'administration et tableaux investisseurs **ne sont pas reliés à la base** à ce stade. Ne pas ouvrir les ventes avec les données de démonstration.

## Installer l'interface complète

L'archive V1.1 est conservée sur Google Drive :
[Archive V1.1 complète](https://drive.google.com/file/d/1Ox95S59Rk8JGgqKpyGlWvBJVtysl-h_C/view)

Le workflow [Import approved Jorsenshop V1.1 UI](.github/workflows/import-approved-ui.yml) télécharge et décompresse l'archive vers `site/`. Cette archive est actuellement privée : le téléchargement GitHub Actions nécessitera que le propriétaire la rende **temporairement accessible à toute personne disposant du lien**. Dès l'import terminé, rétablir le partage restreint.

Le workflow se lance manuellement dans GitHub Actions, ou par une modification de `docs/IMPORT-TRIGGER.md`.

## API lecture seule

| Route | Description |
|---|---|
| `GET /api/health` | Vérifie Neon, ne retourne jamais de secrets |
| `GET /api/products` | Liste des produits publiés et prix validés |
| `GET /api/products/:id` | Détail d'un produit publié |

Les données de démonstration ne sont pas publiées dans Neon : aucun produit ne sera retourné tant que le catalogue n'aura pas été importé et les prix/stock validés.

## Étapes de production restantes

1. Importer les interfaces et leurs images dans `site/`.
2. Vérifier `/api/health` sur Vercel et tester les rendus mobile 320–375 px.
3. Importer le catalogue réel dans Neon, confirmer prix en FC et stocks par taille/couleur.
4. Construire authentification réelle, sessions, protection des rôles et routes internes.
5. Brancher commandes, paiements à livraison, suivi livreur, messages et demandes de remboursement.
6. Valider les chiffres financiers et les conditions contractuelles avant diffusion.

**Sécurité :** les URL internes discrètes ne protègent aucun compte. Une authentification côté serveur est impérative avant toute utilisation privée réelle.

Voir [le guide Vercel](docs/VERCEL.md) et [l'architecture](docs/architecture.md). Les dossiers `functions/` (Cloudflare) et `netlify/` correspondent à des essais précédents et ne sont pas utilisés par Vercel.
