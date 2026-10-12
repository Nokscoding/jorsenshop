-- JorsenShop V2: prices are normal working prices until manager edits them.
-- Publication/ordering never depend on secondary price confirmation.
-- Existing safeguards (stock reservation, positive quantities and price integer) remain intact.

CREATE OR REPLACE FUNCTION place_guest_order(
  p_customer_name text, p_customer_phone text, p_delivery_address text,
  p_delivery_city text, p_delivery_notes text,
  p_items jsonb, p_idempotency_key text, p_tracking_hash text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  entry jsonb;
  v_product products%ROWTYPE;
  v_variant product_variants%ROWTYPE;
  v_qty int;
  v_size text;
  v_subtotal bigint := 0;
  v_fee bigint := 0;
  v_order uuid;
  v_number text;
  v_preexisting orders%ROWTYPE;
  v_count int := 0;
BEGIN
  IF length(trim(p_customer_name)) NOT BETWEEN 2 AND 100
    OR length(trim(p_customer_phone)) NOT BETWEEN 7 AND 32
    OR length(trim(p_delivery_address)) NOT BETWEEN 8 AND 350
    OR length(trim(p_delivery_city)) NOT BETWEEN 2 AND 80
    OR p_idempotency_key !~ '^[a-zA-Z0-9_-]{12,100}$'
    OR p_tracking_hash !~ '^[0-9a-f]{64}$'
  THEN RAISE EXCEPTION 'Informations de commande invalides';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20
  THEN RAISE EXCEPTION 'Panier incorrect'; END IF;
  SELECT * INTO v_preexisting FROM orders WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('orderNumber',v_preexisting.order_number,'total',v_preexisting.total_fc,'existing',true);
  END IF;

  -- Reserve actual units atomically; concurrent requests cannot oversell.
  v_number := 'JS-' || to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('guest_order_seq')::text,6,'0');
  INSERT INTO orders (order_number,customer_name,customer_phone,delivery_address,delivery_city,
    delivery_notes,item_subtotal_fc,delivery_fee_fc,payment_method,idempotency_key,tracking_token_hash)
  VALUES (v_number,trim(p_customer_name),trim(p_customer_phone),trim(p_delivery_address),
    trim(p_delivery_city),left(coalesce(p_delivery_notes,''),600),0,v_fee,'paiement_livraison',p_idempotency_key,p_tracking_hash)
  RETURNING id INTO v_order;

  FOR entry IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_count := v_count + 1;
    IF jsonb_typeof(entry) <> 'object' THEN RAISE EXCEPTION 'Article invalide'; END IF;
    v_qty := coalesce((entry->>'quantity')::int,0);
    v_size := nullif(left(trim(coalesce(entry->>'size','')),16),'');
    IF v_qty < 1 OR v_qty > 10 OR v_size IS NULL
    THEN RAISE EXCEPTION 'Quantité ou taille invalide'; END IF;
    SELECT * INTO v_variant FROM product_variants WHERE id = entry->>'variantId';
    IF NOT FOUND THEN RAISE EXCEPTION 'Variante introuvable'; END IF;
    SELECT * INTO v_product FROM products WHERE id = v_variant.product_id
      AND is_published;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produit non disponible'; END IF;

    UPDATE variant_stock SET quantity = quantity - v_qty
      WHERE variant_id = v_variant.id AND size = v_size
        AND quantity - reserved >= v_qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stock insuffisant pour % / %',v_product.name,v_size; END IF;
    v_subtotal := v_subtotal + v_product.price_fc * v_qty;
    INSERT INTO order_items(order_id,product_id,variant_id,product_name,selected_color,selected_size,quantity,unit_price_fc)
      VALUES(v_order,v_product.id,v_variant.id,v_product.name,v_variant.color,v_size,v_qty,v_product.price_fc);
  END LOOP;
  UPDATE orders SET item_subtotal_fc = v_subtotal WHERE id = v_order;
  RETURN jsonb_build_object('orderNumber',v_number,'total',v_subtotal + v_fee,'existing',false);
END;
$$;

CREATE OR REPLACE FUNCTION staff_save_product(p jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  pid text := p->>'id';
  v jsonb; st record; vid text;
  want_publish boolean := coalesce((p->>'isPublished')::boolean,false);
  confirmed boolean := coalesce((p->>'pricesConfirmed')::boolean,false);
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
      (p->>'priceFc')::bigint,left(coalesce(p->>'tag',''),100),p->'sizes',confirmed,false,now())
    ON CONFLICT (id) DO UPDATE SET
      name=excluded.name,category=excluded.category,description=excluded.description,
      price_fc=excluded.price_fc,tag=excluded.tag,sizes=excluded.sizes,
      prices_confirmed=excluded.prices_confirmed,is_published=false,updated_at=now();

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
