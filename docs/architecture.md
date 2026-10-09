# Architecture Jorsenshop · phase 1

## Isolation
Dépôt : Nokscoding/jorsenshop. Base : projet Neon PostgreSQL **dédié**. Ni tables partagées, ni clé de connexion partagée avec NKS Services ou One Market.

## Chemin d'une requête
Navigateur mobile → https://jorsenshop.com/api/... → Netlify Functions (Node.js) → Neon PostgreSQL (URL uniquement dans Netlify).

Ne jamais appeler Neon directement avec la chaîne DATABASE_URL depuis le navigateur.

## Catalogue
Modèles, variantes de couleur et images sont séparés. Le prix en FC est défini au niveau produit. Les anciennes valeurs de la V1.1 sont des **prix fictifs**, importés en produits **non publiés** jusqu'à validation.

## Droits
Futurs rôles : client, admin, investisseur, livreur. Le rôle ne doit jamais être déterminé par une URL. Les commandes, paiements et données financières doivent être protégés par session serveur, permissions et journal d'audit avant activation.

## Encaissements et rémunération de l'infrastructure
Prévoir une base de calcul sur **ventes des produits réellement encaissées**, hors livraison et remboursements ; taux seulement après signature d'un accord. Aucun versement n'est déclenché automatiquement par ce socle.

## Production
1. Importer la V1.1 validée dans site/ avec toutes les images.
2. Provisionner Neon, placer DATABASE_URL comme secret Netlify.
3. Exécuter la migration 001_initial.sql dans Neon SQL Editor.
4. Importer les produits ; confirmer les prix, les stocks, puis publier.
5. Ajouter authentification, sessions, contrôle d'accès, transactions commandes/stocks et messagerie sécurisée.
6. Recette mobile, privacy, logs, sauvegardes et politiques de remboursement avant vente réelle.
