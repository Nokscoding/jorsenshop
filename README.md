# Jorsenshop

Boutique de vêtements Jorsenshop — projet indépendant de NKS Services et de One Market.

## Situation

- Interfaces **V1.1 mobile-first validées**, conservées séparément dans l'archive de livraison.
- Ce dépôt démarre avec le socle serveur et les migrations SQL : **le frontend et ses 278 photos ne sont pas encore importés ici**.
- Neon PostgreSQL est prévu comme base dédiée, **connexion non effectuée** tant que le compte Neon n'est pas connecté et que le projet n'est pas provisionné.
- Hébergement cible : Netlify, avec fonctions serveur pour accéder à Neon.
- Les prix de la maquette sont fictifs, en francs congolais (FC) : aucun prix de démonstration ne doit être publié pour vente avant validation.

## Démarrage

1. Activer Neon, puis créer une base dédiée à Jorsenshop.
2. Renseigner `DATABASE_URL` **dans les variables secrètes Netlify**, jamais dans le JavaScript navigateur ni dans GitHub.
3. Exécuter `db/migrations/001_initial.sql` dans l'éditeur SQL Neon.
4. `npm install`, puis `npx netlify dev` pour tester `/api/health`.
5. Importer la V1.1 mobile-first dans `site/` (dossier contenant index.html, catalogue.json et assets/) avant le déploiement.
6. Après validation des prix et des stocks, importer le catalogue avec `npm run import:catalogue` puis activer les produits.

## API phase 1

- `GET /api/health` — connectivité de la base, sans exposer les secrets.
- `GET /api/products` — produits publiés, variantes et photos.
- `GET /api/products/:id` — une fiche produit publiée.

Les commandes, paiements, messages, livraisons, remboursements et accès administrateur demandent une authentification et des contrôles de droits côté serveur. **Ils ne sont pas encore activés par ce socle**. Les routes courtes des interfaces internes ne constituent pas une sécurité.

## Notes

Consultez `.env.example` et `docs/architecture.md`. Ne commitez ni connexion Neon, ni secrets, ni données de clients. L'accord commercial concernant une éventuelle rémunération d'infrastructure à 30 % doit être validé séparément et n'est pas un droit automatique codé dans la base.
