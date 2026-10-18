-- Jorsenshop 005 : campagnes / remises produits / codes promotionnels.
-- Exécuter dans Neon (base Jorsenshop), après 001 à 004.
CREATE TABLE IF NOT EXISTS product_discounts (
  product_id TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('percent','fixed')),
  value BIGINT NOT NULL CHECK (value > 0 AND value <= 2000000000),
  active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (kind <> 'percent' OR value <= 95),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS product_discounts_active_idx ON product_discounts(active) WHERE active;

CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{4,32}$'),
  kind TEXT NOT NULL CHECK (kind IN ('percent','fixed')),
  value BIGINT NOT NULL CHECK (value > 0 AND value <= 2000000000),
  min_subtotal_fc BIGINT NOT NULL DEFAULT 0 CHECK (min_subtotal_fc >= 0),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (kind <> 'percent' OR value <= 95),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

ALTER TABLE promo_slides ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE promo_slides ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE promo_slides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE promo_slides ADD COLUMN IF NOT EXISTS button_text TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS promo_slides_sort_idx ON promo_slides(position,id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS regular_subtotal_fc BIGINT NOT NULL DEFAULT 0 CHECK (regular_subtotal_fc >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_fc BIGINT NOT NULL DEFAULT 0 CHECK (discount_fc >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;

-- Les réductions sont appliquées exclusivement côté serveur, dans la même transaction
-- que la réservation du stock et la consommation du code promo.
CREATE OR REPLACE FUNCTION place_guest_order_promo(
 p_customer_name TEXT,p_customer_phone TEXT,p_delivery_address TEXT,
 p_delivery_city TEXT,p_delivery_notes TEXT,p_items JSONB,
 p_idempotency_key TEXT,p_tracking_hash TEXT,p_promo_code TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  entry JSONB;
  v_product products%ROWTYPE;
  v_variant product_variants%ROWTYPE;
  v_discount product_discounts%ROWTYPE;
  v_promo promo_codes%ROWTYPE;
  v_qty INTEGER;
  v_size TEXT;
  v_price BIGINT;
  v_regular BIGINT := 0;
  v_items_total BIGINT := 0;
  v_coupon_discount BIGINT := 0;
  v_fee BIGINT := 0;
  v_order UUID;
  v_number TEXT;
  v_preexisting orders%ROWTYPE;
  v_code TEXT := NULLIF(upper(trim(coalesce(p_promo_code,''))),'');
BEGIN
  IF length(trim(p_customer_name)) NOT BETWEEN 2 AND 100
    OR length(trim(p_customer_phone)) NOT BETWEEN 7 AND 32
    OR length(trim(p_delivery_address)) NOT BETWEEN 8 AND 350
    OR length(trim(p_delivery_city)) NOT BETWEEN 2 AND 80
    OR p_idempotency_key !~ '^[A-Za-z0-9_-]{12,100}$'
    OR p_tracking_hash !~ '^[0-9a-f]{64}$'
    OR (v_code IS NOT NULL AND v_code !~ '^[A-Z0-9_-]{4,32}$')
  THEN RAISE EXCEPTION 'Informations de commande invalides'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20
  THEN RAISE EXCEPTION 'Panier incorrect'; END IF;

  SELECT * INTO v_preexisting FROM orders WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('orderNumber',v_preexisting.order_number,
    'total',v_preexisting.total_fc,'discount',v_preexisting.discount_fc,'existing',true); END IF;

  IF v_code IS NOT NULL THEN
    SELECT * INTO v_promo FROM promo_codes WHERE code=v_code FOR UPDATE;
    IF NOT FOUND OR NOT v_promo.active
      OR (v_promo.starts_at IS NOT NULL AND v_promo.starts_at>now())
      OR (v_promo.ends_at IS NOT NULL AND v_promo.ends_at<=now())
      OR (v_promo.max_uses IS NOT NULL AND v_promo.uses_count>=v_promo.max_uses)
    THEN RAISE EXCEPTION 'Code promo invalide, expiré ou épuisé'; END IF;
  END IF;

  v_number := 'JS-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('guest_order_seq')::text,6,'0');
  INSERT INTO orders(order_number,customer_name,customer_phone,delivery_address,delivery_city,
    delivery_notes,item_subtotal_fc,delivery_fee_fc,payment_method,idempotency_key,tracking_token_hash)
  VALUES(v_number,trim(p_customer_name),trim(p_customer_phone),trim(p_delivery_address),
    trim(p_delivery_city),left(coalesce(p_delivery_notes,''),600),0,v_fee,'paiement_livraison',p_idempotency_key,p_tracking_hash)
  RETURNING id INTO v_order;

  FOR entry IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(entry)<>'object' THEN RAISE EXCEPTION 'Article invalide'; END IF;
    v_qty:=coalesce((entry->>'quantity')::INTEGER,0);
    v_size:=nullif(left(trim(coalesce(entry->>'size','')),16),'');
    IF v_qty NOT BETWEEN 1 AND 10 OR v_size IS NULL THEN RAISE EXCEPTION 'Quantité ou taille invalide'; END IF;
    SELECT * INTO v_variant FROM product_variants WHERE id=entry->>'variantId';
    IF NOT FOUND THEN RAISE EXCEPTION 'Variante introuvable'; END IF;
    SELECT * INTO v_product FROM products WHERE id=v_variant.product_id AND is_published;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produit non disponible'; END IF;

    v_price:=v_product.price_fc;
    SELECT * INTO v_discount FROM product_discounts
      WHERE product_id=v_product.id AND active
        AND (starts_at IS NULL OR starts_at<=now())
        AND (ends_at IS NULL OR ends_at>now());
    IF FOUND THEN
      IF v_discount.kind='percent' THEN
        v_price:=greatest(0,v_price-round(v_price*v_discount.value/100.0)::BIGINT);
      ELSE
        v_price:=greatest(0,v_price-v_discount.value);
      END IF;
    END IF;
    UPDATE variant_stock SET quantity=quantity-v_qty
      WHERE variant_id=v_variant.id AND size=v_size AND quantity-reserved>=v_qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock insuffisant'; END IF;
    v_regular:=v_regular+v_product.price_fc*v_qty;
    v_items_total:=v_items_total+v_price*v_qty;
    INSERT INTO order_items(order_id,product_id,variant_id,product_name,selected_color,selected_size,quantity,unit_price_fc)
    VALUES(v_order,v_product.id,v_variant.id,v_product.name,v_variant.color,v_size,v_qty,v_price);
  END LOOP;

  IF v_code IS NOT NULL THEN
    IF v_items_total<v_promo.min_subtotal_fc THEN RAISE EXCEPTION 'Minimum de commande non atteint'; END IF;
    IF v_promo.kind='percent' THEN
      v_coupon_discount:=round(v_items_total*v_promo.value/100.0)::BIGINT;
    ELSE
      v_coupon_discount:=least(v_items_total,v_promo.value);
    END IF;
    UPDATE promo_codes SET uses_count=uses_count+1,updated_at=now() WHERE code=v_code;
  END IF;

  UPDATE orders SET item_subtotal_fc=v_items_total-v_coupon_discount,
    regular_subtotal_fc=v_regular,discount_fc=v_regular-(v_items_total-v_coupon_discount),
    promo_code=v_code,updated_at=now() WHERE id=v_order;

  RETURN jsonb_build_object('orderNumber',v_number,'total',v_items_total-v_coupon_discount+v_fee,
    'regularSubtotal',v_regular,'discount',v_regular-(v_items_total-v_coupon_discount),
    'promoCode',v_code,'existing',false);
END;
$$;
