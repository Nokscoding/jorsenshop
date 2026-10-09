# V1.1 restored visual · Cloudinary media migration

Le site V1.1 approuvé est restauré (couleurs, logo, carrousel et navigation mobile d’origine). Les images 000–277 ont été copiées dans le Cloudinary dédié `jrgtsxkt`, sauf `098.webp` qui reste uniquement dans l’archive et la version Vercel restaurée. Le logo et les deux vidéos ont aussi été transférés.

Les images doivent être servies via le CDN Cloudinary sans modifier l’interface. La solution qui télécharge le ZIP au build dépend d’une URL signée temporaire : elle n’est **pas durable**. Les sources originales doivent être versionnées dans GitHub avant toute nouvelle publication permanente. Les données Neon restent distinctes de la maquette frontend et aucun encaissement réel ne doit passer par les simulations en localStorage.
