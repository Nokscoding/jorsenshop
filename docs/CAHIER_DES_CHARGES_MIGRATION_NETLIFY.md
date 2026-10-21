# Cahier des charges — migration et remise en service de Jorsenshop sur Netlify

**Projet :** Jorsenshop  
**Dépôt :** `Nokscoding/jorsenshop`  
**Hébergement cible :** Netlify, site existant `jorsenshop`  
**Base de données :** Neon PostgreSQL, projet et base `jorsenshop`  
**Règle directrice :** migration et corrections sans régression visuelle ni fonctionnelle.

## 1. Objectif
Rendre Jorsenshop utilisable sur Netlify, avec une boutique reliée à une base persistante et un espace gérant réellement opérationnel. Ne pas recréer le site et ne pas remplacer le design validé par une nouvelle maquette.

## 2. Règles non négociables
- Préserver le design mobile-first, les pages, les chemins, les images, les vidéos, les fiches produits, les variantes, les interfaces et les textes existants.
- Ne modifier que les éléments nécessaires à la migration et aux fonctions qui ne marchent pas.
- Ne pas supprimer de fonctionnalité existante sans équivalent fonctionnel testé.
- Ne pas bloquer la mise en service sur la validation des prix : utiliser des prix temporaires fictifs en FC quand un prix manque ou est inutilisable. Le gérant doit pouvoir les modifier depuis son espace.
- Identifier clairement les prix de démonstration dans les données/code ou la documentation interne, sans ajouter d'avertissements disgracieux sur le site public.
- Ne jamais exposer de secrets, clés, chaînes de connexion ou données privées côté navigateur, dans GitHub ou dans les journaux.
- Ne pas déclarer le site opérationnel avant les tests réels du déploiement.
- Ne pas activer de paiement réel si aucun prestataire de paiement n'est configuré. La V1 peut fonctionner avec commande et paiement à la livraison (COD), selon les fonctions existantes.
- Toute modification doit être ciblée, relue et testée. Préférer une branche de travail et un déploiement de prévisualisation avant publication.

## 3. Audit initial obligatoire
- Inspecter la branche `main`, l'historique, les dossiers `site/`, `netlify/functions/`, `db/`, les scripts d'import et les configurations.
- Comparer les parcours visibles et les fonctions annoncées avec leur implémentation réelle.
- Vérifier les réglages Netlify : dépôt lié, branche de production, commande de build, dossier publié, fonctions et redirections.
- Vérifier les variables d'environnement du site et de l'équipe sans afficher leurs valeurs secrètes.
- Vérifier le schéma Neon et l'état des tables avant toute migration destructive.
- Établir une liste des écarts avant de modifier le code.

## 4. Configuration Netlify
- Utiliser le site Netlify existant `jorsenshop` et relier le dépôt `Nokscoding/jorsenshop`, branche `main`, sauf si la configuration existante révèle un risque.
- Conserver le dossier publié `site` et les fonctions `netlify/functions`.
- Conserver et tester la redirection `/api/*` vers la fonction API Netlify.
- Configurer `DATABASE_URL` comme variable secrète côté serveur, avec la base Neon **jorsenshop** (pas `neondb` par défaut). Ne jamais inscrire la valeur dans un fichier versionné ou dans une réponse.
- Vérifier que les dépendances et la version Node sont compatibles avec le runtime Netlify.
- Vérifier `/api/health` : réponse attendue `{ "ok": true, "database": "connected" }`.
- Vérifier les journaux de build et de fonctions après chaque déploiement.

## 5. Boutique et données
- Connecter le catalogue affiché à la base Neon, avec états de chargement, erreur et catalogue vide gérés proprement.
- Préserver produits, catégories, photos, variantes, tailles et stock.
- Utiliser des prix temporaires plausibles en FC pour les produits sans prix exploitable ; aucune approbation préalable du propriétaire n'est requise pour cette valeur de démarrage.
- Les prix et stocks doivent être modifiables dans l'espace gérant et sauvegardés en base, puis visibles après actualisation.
- Empêcher les prix invalides (valeurs négatives, NaN ou texte non numérique) côté serveur, sans bloquer l'usage normal.
- Éviter les doublons d'import et préserver les identifiants existants.
- Les commandes et leur statut doivent être persistants si cette fonction est présente dans le périmètre V1 ; ne pas simuler une commande réussie en localStorage.

## 6. Espace gérant et rôles
- Auditer les espaces gérant, investisseur et livreur déjà présents ; préserver leur identité visuelle.
- Remplacer les actions de démonstration/localStorage par des opérations serveur et base de données lorsqu'elles prétendent modifier des données réelles.
- Permettre au gérant de gérer au minimum produits, prix, disponibilité/stock, commandes et promotions selon l'interface existante.
- Ajouter une authentification serveur réelle et vérifier les autorisations par rôle côté serveur ; ne pas faire confiance à un rôle stocké uniquement dans le navigateur.
- Les erreurs d'enregistrement doivent être visibles et ne doivent pas afficher de faux message de réussite.
- Ne pas inventer ni exposer de mots de passe. Si la création du compte gérant exige un secret ou une action d'autorisation que les accès connectés ne permettent pas d'effectuer, terminer tout le reste et demander uniquement cette action précise.

## 7. Commandes et sécurité
- Conserver le flux de commande et la livraison à la livraison (COD) prévu pour la V1 si le parcours existe.
- Calculer et revérifier côté serveur prix, quantités et total de commande à partir des données persistées.
- Valider toutes les entrées et utiliser des requêtes paramétrées.
- Ne pas exposer d'informations sensibles dans les réponses publiques.
- Protéger les routes privées, limiter les opérations par rôle et éviter les écritures publiques non autorisées.
- Ne pas activer de paiement carte ou Mobile Money sans intégration réelle.

## 8. Vérifications anti-régression
Avant la publication :
- Vérifier accueil, catalogue, catégories, recherche/filtrage, fiche produit, variantes/tailles, images et vidéos.
- Vérifier affichage mobile et desktop, navigation, liens et chemins d'assets.
- Vérifier API santé, lecture du catalogue, lecture d'un produit, erreurs et absence de configuration.
- Vérifier connexion gérant, permissions, modification d'un prix fictif, sauvegarde en base et persistance après rechargement.
- Vérifier stocks, promotions et commandes si inclus dans la version livrée.
- Vérifier qu'un utilisateur non autorisé ne peut pas modifier les données.
- Vérifier qu'aucun secret n'apparaît dans les bundles, le dépôt ou les logs.
- Vérifier le build Netlify et consulter le déploiement publié.
- Comparer les parcours principaux à la version de référence avant de promouvoir la version.

## 9. Déploiement et retour arrière
- Faire les changements sur une branche de travail.
- Garder la version actuellement publiée disponible pour rollback.
- Ne promouvoir que si le build est réussi et les tests essentiels passent.
- Si un test critique échoue, corriger ou revenir à la dernière version stable ; ne pas masquer l'échec.
- Après publication, vérifier l'URL publique et les routes API réellement servies.

## 10. Critères d'acceptation
La migration est considérée terminée lorsque :
1. Le site existant est servi par Netlify sans régression visuelle majeure.
2. La fonction `/api/health` confirme une connexion Neon réelle.
3. Le catalogue provient de données persistantes et les prix temporaires sont affichés en FC.
4. Le gérant peut modifier et enregistrer un prix sans intervention technique.
5. Les parcours testés ne renvoient pas de faux succès ni ne dépendent du seul localStorage pour les opérations réelles.
6. Les autorisations côté serveur protègent les actions privées.
7. Le build et les vérifications après déploiement réussissent.
8. Les éventuels blocages restants sont listés précisément, sans prétendre que le site est prêt si ce n'est pas le cas.

## 11. Ordre d'exécution
1. Audit du dépôt, de Netlify et de Neon.
2. Sauvegarde logique et définition de la référence anti-régression.
3. Configuration de l'environnement Netlify.
4. Réparation de la connexion API/base et import idempotent du catalogue si nécessaire.
5. Mise en place des prix temporaires et de leur édition par le gérant.
6. Réparation des parcours de gestion, commandes et rôles selon le périmètre réel.
7. Tests automatisés/manuels, build et vérification des logs.
8. Déploiement de prévisualisation, correction, puis publication.
9. Compte rendu concis : changements effectués, tests réussis/échoués, URL et blocages précis.

## 12. État connu au démarrage
- Un fichier `netlify.toml` existe et publie `site`, avec fonctions dans `netlify/functions`.
- Une fonction `netlify/functions/api.mjs` existe ; elle expose actuellement une API en lecture seule pour la santé et le catalogue.
- La configuration du site Netlify ne retournait aucune variable d'environnement lors du dernier contrôle.
- La base Neon et la migration initiale sont documentées comme existantes ; il faut revérifier leur état sans supprimer de données.
- Le document de déploiement existant indique que certaines interfaces V1.1 reposent encore sur `localStorage). Il faut le vérifier dans le code réel avant d'affirmer qu'une fonction est opérationnelle.
