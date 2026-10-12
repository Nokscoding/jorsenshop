-- JorsenShop V2: account required at checkout, pricing totals accurate, idempotent retry ownership.
-- Safe function replacements; no destructive table operations.

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
  UPDATE orders SET item_subtotal_fc = v_subtotal, total_fc = v_subtotal + v_fee WHERE id = v_order;
  RETURN jsonb_build_object('orderNumber',v_number,'total',v_subtotal + v_fee,'existing',false);
END;
$$;

CREATE OR REPLACE FUNCTION place_v2_order(
 p_auth_user text, p_customer_name text, p_customer_phone text,
 p_address text,p_city text,p_notes text,
 p_items jsonb,p_idempotency_key text,p_tracking_hash text,p_delivery_mode text,p_payment_provider text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_shipping v2_shipping_methods%ROWTYPE;
 v_result jsonb; v_number text; v_fee bigint; v_city v2_cities%ROWTYPE;
BEGIN
 IF p_auth_user IS NULL OR length(trim(p_auth_user))<8 THEN RAISE EXCEPTION 'Connexion obligatoire pour commander'; END IF;
 SELECT * INTO v_city FROM v2_cities WHERE code=p_city AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ville non desservie'; END IF;
 SELECT * INTO v_shipping FROM v2_shipping_methods
 WHERE city_code=p_city AND code=p_delivery_mode AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Mode de livraison indisponible'; END IF;
 IF v_shipping.prepaid AND p_payment_provider NOT IN ('airtel_money','orange_money') THEN RAISE EXCEPTION 'Moyen de paiement requis'; END IF;
 IF v_city.delivery_type='expedition' AND NOT v_shipping.prepaid THEN
   RAISE EXCEPTION 'Expédition prépayée obligatoire';
 END IF;
 SELECT place_guest_order(p_customer_name,p_customer_phone,p_address,v_city.name,
      p_notes,p_items,p_idempotency_key,p_tracking_hash) INTO v_result;
 v_number:=v_result->>'orderNumber';
 IF (v_result->>'existing')::boolean AND NOT EXISTS (
   SELECT 1 FROM orders WHERE order_number=v_number AND v2_client_auth_id=p_auth_user
     AND v2_delivery_mode=p_delivery_mode
 ) THEN RAISE EXCEPTION 'Reprise de commande non autorisée'; END IF;
 UPDATE orders SET delivery_fee_fc=v_shipping.fee_fc,total_fc=item_subtotal_fc+v_shipping.fee_fc,
   v2_delivery_mode=p_delivery_mode,v2_client_auth_id=p_auth_user,
   v2_payment_provider=CASE WHEN v_shipping.prepaid THEN p_payment_provider ELSE NULL END,
   payment_method=CASE WHEN v_shipping.prepaid THEN 'mobile_money' ELSE 'paiement_livraison' END
 WHERE order_number=v_number
   AND (v2_client_auth_id IS NULL OR v2_client_auth_id=p_auth_user);
 IF NOT FOUND THEN RAISE EXCEPTION 'Conflit de propriétaire de commande'; END IF;
 SELECT total_fc INTO v_fee FROM orders WHERE order_number=v_number;
 RETURN jsonb_build_object('orderNumber',v_number,'total',v_fee,
       'deliveryFeeFc',v_shipping.fee_fc,'prepaid',v_shipping.prepaid,
       'existing',coalesce((v_result->>'existing')::boolean,false));
END $$;
