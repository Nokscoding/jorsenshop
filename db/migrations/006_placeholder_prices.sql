-- 006 Prix arbitraires / indicatifs, modifiables sans approbation.
-- Idempotent: respecte les tarifs déjà ajustés et ne modifie que l'ancien catalogue.
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_is_placeholder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ALTER COLUMN prices_confirmed SET DEFAULT true;
WITH bands AS (
 SELECT id, CASE category WHEN 'Accessoires' THEN 45000 WHEN 'Chaussures' THEN 125000 WHEN 'Chemises' THEN 75000 WHEN 'Ensembles' THEN 135000 WHEN 'Pantalons' THEN 85000 WHEN 'Polos' THEN 60000 WHEN 'Pulls & Sweats' THEN 80000 WHEN 'T-shirts' THEN 45000 WHEN 'Vestes' THEN 145000 ELSE 65000 END::bigint AS low,
 CASE category WHEN 'Accessoires' THEN 100000 WHEN 'Chaussures' THEN 245000 WHEN 'Chemises' THEN 135000 WHEN 'Ensembles' THEN 230000 WHEN 'Pantalons' THEN 155000 WHEN 'Polos' THEN 115000 WHEN 'Pulls & Sweats' THEN 160000 WHEN 'T-shirts' THEN 95000 WHEN 'Vestes' THEN 275000 ELSE 150000 END::bigint AS high
 FROM products WHERE prices_confirmed=false
), generated AS (
 SELECT id,low+(abs(hashtext(id)::bigint)%((high-low)/5000+1))*5000 AS new_price FROM bands
)
UPDATE products p SET price_fc=g.new_price, prices_confirmed=true, price_is_placeholder=true, updated_at=now()
FROM generated g WHERE p.id=g.id;

-- Enregistrement des produits sans confirmation du prix.
-- Atomic product/variant/stock write for one Jorsenshop manager.
CREATE OR REPLACE FUNCTION staff_save_product(p jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  pid text := p->>'id';
  v jsonb; st record; vid text;
  want_publish boolean := coalesce((p->>'isPublished')::boolean,false);
  total_stock int := 0;
  image_count int := 0;
BEGIN
  IF pid !~ '^js-[a-zA-Z0-9_-]{3,64}$'
    OR length(trim(coalesce(p->>'name',''))) NOT BETWEEN 2 AND 150
    OR length(trim(coalesce(p->>'category',''))) NOT BETWEEN 2 AND 80
    OR (p->>'priceFc')::bigint < 0
    OR jsonb_typeof(p->'variants') <> 'array'
    OR jsonb_array_length(p->'variants') NOT BETWEEN 1 AND 40
    OR jsonb_typeof(p->'sizes') <> 'array'
  THEN RAISE EXCEPTION 'Fiche produit incorrecte'; END IF;
  INSERT INTO products(id,name,category,description,price_fc,tag,sizes,prices_confirmed,is_published,updated_at)
    VALUES(pid,trim(p->>'name'),trim(p->>'category'),left(coalesce(p->>'description',''),3000),
      (p->>'priceFc')::bigint,left(coalesce(p->>'tag',''),100),p->'sizes',true,false,now())
    ON CONFLICT (id) DO UPDATE SET
      name=excluded.name,category=excluded.category,description=excluded.description,
      price_fc=excluded.price_fc,tag=excluded.tag,sizes=excluded.sizes,
      prices_confirmed=true,price_is_placeholder=CASE WHEN products.price_fc IS DISTINCT FROM excluded.price_fc THEN false ELSE products.price_is_placeholder END,is_published=false,updated_at=now();

  FOR v IN SELECT value FROM jsonb_array_elements(p->'variants') LOOP
    vid := v->>'id';
    IF vid !~ '^js-[a-zA-Z0-9_-]{3,64}-v[a-zA-Z0-9_-]+$'
      OR left(vid,length(pid)) <> pid
      OR length(coalesce(v->>'color','')) NOT BETWEEN 1 AND 80
      OR jsonb_typeof(v->'images') <> 'array'
    THEN RAISE EXCEPTION 'Variante incorrecte'; END IF;
    image_count := image_count + jsonb_array_length(v->'images');
    INSERT INTO product_variants(id,product_id,color,images)
      VALUES(vid,pid,left(v->>'color',80),v->'images')
      ON CONFLICT (id) DO UPDATE SET color=excluded.color,images=excluded.images;
    FOR st IN SELECT key,value FROM jsonb_each_text(coalesce(v->'stock','{}'::jsonb)) LOOP
       IF length(st.key) > 16 OR (st.value)::int NOT BETWEEN 0 AND 100000
       THEN RAISE EXCEPTION 'Stock invalide'; END IF;
       total_stock := total_stock + (st.value)::int;
       INSERT INTO variant_stock(variant_id,size,quantity) VALUES(vid,st.key,(st.value)::int)
       ON CONFLICT(variant_id,size) DO UPDATE SET quantity=excluded.quantity
       WHERE variant_stock.reserved <= excluded.quantity;
    END LOOP;
  END LOOP;
  IF want_publish AND (total_stock <= 0 OR image_count <= 0)
  THEN RAISE EXCEPTION 'Photo et stock obligatoires pour publication'; END IF;
  UPDATE products SET is_published=want_publish WHERE id=pid;
  RETURN pid;
END;
$$;

-- Commandes: produits publiés utilisables avec tarif défini par l'admin.
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

