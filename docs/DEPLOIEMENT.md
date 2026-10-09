# Livraison V1.1 à intégrer

La version approuvée du site **Jorsenshop V1.1 — mobile-first** contient 73 fiches produits, 272 variantes et leurs photos, ainsi que les trois interfaces internes.

- [Archive complète sur Google Drive](https://drive.google.com/file/d/1Ox95S59Rk8JGgqKpyGlWvBJVtysl-h_C/view)
- Dossier à extraire : `Jorsenshop_V1/`
- Destination dans ce dépôt : `site/`, en conservant les chemins des sous-dossiers (`assets/products`, `assets/videos`, `s/*`).
- Import de catalogue : `site/catalogue.json`.
- **Ne pas rendre cette V1.1 publique comme boutique opérationnelle** : toutes les commandes, les rôles et les tableaux de bord sont actuellement des démonstrations en localStorage et les prix ne sont pas validés.

## Netlify

Projet créé : https://app.netlify.com/projects/jorsenshop

1. Lier la branche `main` du dépôt `Nokscoding/jorsenshop` dans les paramètres de déploiement Netlify.
2. Sous `Environment variables`, ajouter `DATABASE_URL` avec la chaîne de connexion à la base **jorsenshop** du projet Neon **jorsenshop** (ne pas choisir neondb par défaut). Marquer la valeur comme secrète et ne jamais l'envoyer dans un chat ou la committer.
3. Les fonctions du dossier `netlify/functions` seront utilisées par la route `/api/*`.
4. Vérifier `/api/health` après le déploiement. Il doit retourner `{ "ok": true, "database": "connected" }` ; cette vérification n'est **pas encore effectuée**.
5. Les prix fictifs et le stock doivent être confirmés, et l'authentification avec rôles doit être développée avant l'activation de commandes réelles.

## Base PostgreSQL déjà mise en place

- Projet Neon : `jorsenshop`, identifiant `long-union-90591291`
- Branche : `production`, `br-billowing-math-b5t9nggd`
- Base : `jorsenshop` (distincte de `neondb`)
- Migration `db/migrations/001_initial.sql` exécutée et vérifiée (15 tables et une vue).

**À faire** : importer le front V1.1 dans GitHub et configurer la connexion Netlify. L'archive sur Drive est une sauvegarde de transfert, pas une preuve de déploiement.
