# Jorsenshop — Cloudinary pour les médias

**Décision :** les photos seront servies par Cloudinary en production, pas directement depuis GitHub/Vercel.

## Environnement connecté

- Compte Cloudinary connecté : `nks-services` (également utilisé par One Market).
- Dossier Jorsenshop créé : `jorsenshop/catalog`.
- 278 images WebP dans l'archive V1.1, regroupées en 73 fiches et 272 variantes.
- 2 vidéos lookbook pourront être transférées dans `jorsenshop/lookbook` séparément.
- **Aucune des 278 images n'a encore été transférée sur Cloudinary.** Le connecteur d'upload accepte des URL publiques ou data URI, mais pas le chemin local du ZIP de la conversation.

## Convention des public_id

Pour éviter toute ambiguïté et préserver le catalogue :
- `assets/products/000.webp` → `jorsenshop/catalog/000`
- `assets/products/001.webp` → `jorsenshop/catalog/001`
- etc., jusqu'à `277.webp`.

Exemple **prévisionnel, pas encore publié** :
`https://res.cloudinary.com/nks-services/image/upload/f_auto,q_auto,w_960,c_limit/jorsenshop/catalog/000.webp`

Après upload réussi, le site utilisera un fichier `cdn.js` qui mappe les chemins d'origine aux URLs retournées par Cloudinary ; tant que la migration n'est pas faite, le site peut garder ses photos locales.

## Script d'import local

La version Cloudinary-ready du ZIP inclut `tools/upload_cloudinary.py` (Python standard uniquement) :
```bash
python tools/upload_cloudinary.py --zip Jorsenshop_V1_2_Cloudinary_Pret.zip
# Avant le vrai transfert, configurer localement :
# CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET
python tools/upload_cloudinary.py --zip Jorsenshop_V1_2_Cloudinary_Pret.zip --upload --cdn-js cdn.js
```
Le script vérifie la présence des 278 images, charge les assets par public_id stables, reprend son progrès à partir d'un manifeste local et produit un `cdn.js`. Ne jamais communiquer les clés secrètes dans une conversation ou les committer sur GitHub.

## Séparation économique et technique

Le dossier `jorsenshop/` évite de mélanger les fichiers avec One Market, mais un dossier séparé **n'isole pas les quotas, les administrateurs ni la facturation** du compte `nks-services`. Si Jorsenshop doit être entièrement autonome, utiliser un environnement Cloudinary indépendant avant l'import définitif.

## GitHub → Vercel

Le workflow d'import depuis Google Drive a été déclenché le 9 octobre 2026 mais a échoué avant toute étape de téléchargement :
https://github.com/Nokscoding/jorsenshop/actions/runs/37973281594

Ne pas interpréter l'échec comme une importation réussie. Tant que le frontend complet n'a pas été synchronisé dans GitHub, Vercel affiche encore une page de préparation.
