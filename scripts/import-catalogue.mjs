// Import du catalogue V1.1 sans publication des prix fictifs.
import fs from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL manquant. Renseignez-le localement, jamais dans les pages HTML.');
  process.exit(1);
}
const filename = process.env.CATALOG_PATH || 'site/catalogue.json';
const catalogue = JSON.parse(await fs.readFile(filename, 'utf8'));
if (!Array.isArray(catalogue)) throw new Error('Le catalogue doit être un tableau JSON.');

const sql = neon(process.env.DATABASE_URL);
let variantCount = 0;
for (const product of catalogue) {
  if (!/^js-[a-zA-Z0-9_-]+$/.test(product.id)) throw new Error('Produit invalide: ' + product.id);
  if (!Array.isArray(product.variants) || !product.variants.length) {
    throw new Error('Aucune variante pour ' + product.id);
  }
  const price = Math.max(0, Math.trunc(Number(product.price) || 0));
  await sql.query([
    'INSERT INTO products (id,name,category,description,price_fc,tag,sizes,is_published,prices_confirmed)',
    'VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,false,false)',
    'ON CONFLICT (id) DO UPDATE SET',
    'name=EXCLUDED.name,category=EXCLUDED.category,description=EXCLUDED.description,',
    'tag=EXCLUDED.tag,sizes=EXCLUDED.sizes,',
    'price_fc=CASE WHEN products.prices_confirmed THEN products.price_fc ELSE EXCLUDED.price_fc END,',
    'updated_at=now()'
  ].join(' '), [
    product.id, product.name, product.category, product.description || '',
    price, product.tag || '', JSON.stringify(product.sizes || [])
  ]);
  for (const variant of product.variants) {
    await sql.query([
      'INSERT INTO product_variants (id,product_id,color,images) VALUES ($1,$2,$3,$4::jsonb)',
      'ON CONFLICT (id) DO UPDATE SET color=EXCLUDED.color, images=EXCLUDED.images'
    ].join(' '), [
      variant.id, product.id, variant.color || 'Autre', JSON.stringify(variant.images || [])
    ]);
    variantCount++;
  }
}
console.log('Import terminé :', catalogue.length, 'modèles et', variantCount, 'variantes.');
console.log('Produits NON PUBLIÉS tant que les prix et les stocks ne sont pas validés.');
