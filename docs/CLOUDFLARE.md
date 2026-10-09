# Déploiement Jorsenshop sur Cloudflare Pages

## Déjà préparé

- Projet GitHub `Nokscoding/jorsenshop`
- Neon `jorsenshop` (base `jorsenshop` sur branche `production`, migrations exécutées).
- `functions/api/[[path]].js` : API Cloudflare Pages pour **lecture publique uniquement**.
- `wrangler.toml` : publication `site/`.
- `site/_routes.json` : seules les routes `/api/*` invoquent les Pages Functions.

## Étapes qui exigent une session Cloudflare

1. Créer ou ouvrir le compte sur https://dash.cloudflare.com/.
2. Ouvrir Workers & Pages → Create application → Pages → Import an existing Git repository.
3. Choisir GitHub `Nokscoding/jorsenshop`, branche `main`.
4. **Build command** : `exit 0`. **Build output directory** : `site`.
5. Variables and Secrets → `DATABASE_URL` → définir comme **Secret** (copier la connexion depuis la base Neon `jorsenshop`, ne jamais publier).
6. Déployer et tester `/api/health` ; réponse attendue quand la connexion est OK : `{"ok":true,"database":"connected"}`.
7. Importer l'interface V1.1 validée et les médias dans `site/`. Tant que ceci n'est pas terminé, le déploiement présente seulement une page d'attente technique.

## Sécurité et conformité

- Le client ne reçoit jamais `DATABASE_URL`.
- La base doit rester privée des projets NKS et One Market.
- Ne jamais utiliser la longueur ou la complexité des URL (`/s/a7m4/`, etc.) comme système de permission.
- Aucun endpoint d'écriture public avant authentification serveur, session protégée, autorisation par rôle, validation des données et contrôles transactionnels.
- Ne pas publier des chiffres fictifs du tableau investisseur comme des recettes réelles.
- Ne pas valider de commandes commerciales tant que prix, stocks, livraison et politique de remboursement ne sont pas confirmés.
- Seules les ventes encaissées, les remboursements et le contrat commercial signé pourront fonder une rémunération d'infrastructure, pas un taux imposé par la maquette.

## Migration de l'interface

Archive de référence : https://drive.google.com/file/d/1Ox95S59Rk8JGgqKpyGlWvBJVtysl-h_C/view

Les fichiers contenus sous `Jorsenshop_V1/` doivent aller sous `site/` en préservant les sous-répertoires. Le catalogue contient 73 fiches de modèles et 272 variantes ; après intégration, contrôler les images et variantes avec l'interface mobile et en largeur d'écran 320 px et 375 px.

## Commandes locales

```bash
npm install
npm run dev
```

Un fichier local `.dev.vars` contenant `DATABASE_URL` (non versionné) est nécessaire pour tester les fonctions contre Neon. Les produits restent non publiés tant que les prix ne sont pas certifiés.
