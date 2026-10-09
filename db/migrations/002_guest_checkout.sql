-- Jorsenshop migration 002: guest checkout and secure audit trail
-- Idempotent: dedicated project database jorsenshop only
CREATE SEQUENCE IF NOT EXISTS guest_order_seq START 1001;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT;
CREATE INDEX IF NOT EXISTS orders_tracking_hash_idx ON orders (tracking_token_hash);

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
      AND is_published AND prices_confirmed;
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

CREATE OR REPLACE FUNCTION staff_update_order(
  p_number text,p_status text,p_paid boolean
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE o orders%ROWTYPE; line order_items%ROWTYPE;
BEGIN
 SELECT * INTO o FROM orders WHERE order_number=p_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Commande introuvable'; END IF;
 IF p_status IS NOT NULL AND p_status NOT IN ('a_confirmer','confirmee','en_preparation','en_livraison','livree','annulee')
 THEN RAISE EXCEPTION 'Statut incorrect'; END IF;
 IF o.status='annulee' AND p_status IS DISTINCT FROM 'annulee' THEN
   RAISE EXCEPTION 'Commande annulée : nouvelle commande nécessaire'; END IF;
 IF p_status='annulee' AND o.status<>'annulee' THEN
   IF o.payment_status='payee' THEN RAISE EXCEPTION 'Remboursement nécessaire avant annulation'; END IF;
   FOR line IN SELECT * FROM order_items WHERE order_id=o.id LOOP
     UPDATE variant_stock SET quantity=quantity+line.quantity WHERE variant_id=line.variant_id AND size=line.selected_size;
   END LOOP;
 END IF;
 UPDATE orders
   SET status=coalesce(p_status,status),
     payment_status=CASE WHEN p_paid IS TRUE THEN 'payee' ELSE payment_status END,
     paid_at=CASE WHEN p_paid IS TRUE THEN coalesce(paid_at,now()) ELSE paid_at END,
     updated_at=now()
   WHERE id=o.id;
 RETURN jsonb_build_object('orderNumber',o.order_number,'ok',true);
END;
$$;
