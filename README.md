# Jorsenshop · Cloudflare Pages + Neon

Boutique Jorsenshop, projet **séparé de NKS Services et de One Market**.

## État du projet

- **GitHub :** `Nokscoding/jorsenshop`.
- **Neon :** projet `jorsenshop`, base `jorsenshop`, branche `production` ; migration `db/migrations/001_initial.sql` appliquée (15 tables).
- **Cloudflare Pages :** configuration et fonction API préparées dans ce dépôt, mais **aucun projet Cloudflare ni déploiement ne sont confirmés**.
- **Interface V1.1 mobile-first validée :** disponible en ZIP, à intégrer à `site/`. Le dépôt contient encore un `site/index.html` provisoire. Ne pas annoncer une boutique en ligne à ce stade.
- Prix de démonstration en **francs congolais (FC)**, sans validation commerciale.

## Configuration Cloudflare

1. Ouvrir [Cloudflare Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
2. Choisir **Create application → Pages → Import an existing Git repository**.
3. Sélectionner `Nokscoding/jorsenshop` ; branche `main`.
4. Configuration de la compilation : **Build command** `exit 0`, **Build output directory** `site`.
5. Dans **Settings → Variables and Secrets**, définir `DATABASE_URL` comme **secret**, avec la connexion à la base Neon **jorsenshop** (pas `neondb`). Ne jamais l'inclure dans GitHub, les pages HTML ou les captures d'écran.
6. Les routes de l'API Cloudflare sont servies via `functions/api/[[path]].js`. Tester `/api/health` après déploiement.
7. **Ne pas lancer les ventes** avant import de la V1.1, vérification des prix/stocks, et contrôle d'accès serveur pour les espaces privés.

## API · Phase 1

- `GET /api/health` — connexion Neon.
- `GET /api/products` — catalogue **publié et dont les prix sont confirmés**.
- `GET /api/products/:id` — fiche produit publique.

Aucun endpoint d'écriture n'est activé : commande, compte, paiement, messagerie, livraison et tableau investisseur requièrent encore une authentification/autorisation serveur.

## Développement

```bash
npm install
# Créer .dev.vars localement (fichier ignoré par Git) :
# DATABASE_URL="postgresql://..."
npm run dev
```

**Ne commitez jamais `.dev.vars`**, les secrets Neon ou de vraies données clients.

## Ressources

- [Archive complète de l'interface V1.1 validée](https://drive.google.com/file/d/1Ox95S59Rk8JGgqKpyGlWvBJVtysl-h_C/view)
- [Migration PostgreSQL](db/migrations/001_initial.sql)
- [Guide d'intégration Cloudflare](docs/CLOUDFLARE.md)
