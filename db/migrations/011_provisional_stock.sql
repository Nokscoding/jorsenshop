-- Jorsenshop : données d'inventaire provisoires approuvées le 17 octobre 2026.
-- Cette migration est conservée pour audit/reconstitution : elle ne modifie JAMAIS
-- les quantités déjà saisies par le gérant.
-- Chiffres volontairement arbitraires : NE PAS les assimiler au stock réel.
-- Les prix de vente et les coûts d'achat ne sont pas modifiés.
ALTER TABLE variant_stock
  ADD COLUMN IF NOT EXISTS is_provisional boolean NOT NULL DEFAULT false;

WITH candidates AS (
  SELECT v.id AS variant_id, trim(sz.size_value) AS size,
         (2 + floor(random() * 5))::int AS quantity
  FROM product_variants v
  JOIN products p ON p.id = v.product_id
  CROSS JOIN LATERAL jsonb_array_elements_text(p.sizes) AS sz(size_value)
  WHERE p.is_published
    AND length(trim(sz.size_value)) BETWEEN 1 AND 16
)
INSERT INTO variant_stock (variant_id,size,quantity,is_provisional)
SELECT variant_id,size,quantity,true FROM candidates
ON CONFLICT (variant_id,size) DO NOTHING;
-- Une modification manuelle via l'API gérant efface is_provisional pour la ligne.
