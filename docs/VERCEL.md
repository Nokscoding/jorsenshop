# Jorsenshop sur Vercel · guide de déploiement

## État réel

- Projet Vercel : [jorsenshop](https://vercel.com/nks16/jorsenshop), créé et lié au dépôt GitHub `Nokscoding/jorsenshop`.
- Déploiements automatiques fonctionnels sur les commits de `main`.
- Projet Neon `jorsenshop`, base `jorsenshop`, 15 tables PostgreSQL et vue financière.
- Secret `DATABASE_URL` enregistré dans Vercel, ciblant la base `jorsenshop` (chiffré, non présent dans le code).
- Page temporaire : `site/index.html`. L'interface V1.1 et toutes les photos **ne sont pas encore importées** dans GitHub.
- Protection Vercel : authentification Vercel appliquée aux URL de déploiement selon les réglages actuels.

## API

- `/api/health` : vérification de la connexion Neon.
- `/api/products` : produits validés et publiés.
- `/api/products/<id>` : fiche produit.

Les API sont codées, mais les tests HTTP depuis l'assistant peuvent être refusés par la protection Vercel. Ne pas prétendre que les endpoints sont vérifiés sans un appel abouti.

## Faire venir les fichiers de l'interface validée

Archive : https://drive.google.com/file/d/1Ox95S59Rk8JGgqKpyGlWvBJVtysl-h_C/view

Option automatique : le workflow GitHub `.github/workflows/import-approved-ui.yml` décompresse les ressources dans `site/`. Il peut être déclenché par un commit sur `docs/IMPORT-TRIGGER.md`.

**Précondition de l'import automatique :** le propriétaire rend temporairement ce ZIP accessible à toute personne disposant du lien dans les paramètres de partage de Google Drive. Vérifier que l'archive ne contient pas de secrets ou de données privées avant ce partage. Après le succès du workflow, remettre la restriction d'accès Drive.

L'import doit contenir au moins 272 photos produits et les fichiers `index.html` et `catalogue.json` ; le workflow vérifie ces conditions avant le push.

## Mise en production réelle

La V1.1 contient un **catalogue et des commandes de démonstration**. Les variantes doivent être importées dans Neon après la synchronisation du frontend. Les prix FC et stocks doivent être validés avant publication. Authentification, session serveur, permissions administrateur/investisseur/livreur, suivi de livraisons, paiement et messagerie doivent être fonctionnels avant d'exposer ces espaces à des utilisateurs réels.

### Points de sécurité

- Ne jamais envoyer la connexion Neon au navigateur ou la committer.
- Ne pas utiliser les URL discrètes comme mesure de contrôle d'accès.
- Les accords de rémunération de l'infrastructure ne sont pas automatiquement actifs : seule une convention valide peut fixer une assiette et un taux.
- Vérifier la formule Vercel autorise une utilisation commerciale avant l'ouverture de la boutique.
