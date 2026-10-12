-- JorsenShop V2 category maintenance + courier transaction helpers.
CREATE OR REPLACE FUNCTION v2_rename_category(p_old text,p_new text,p_slug text)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
 IF length(trim(p_new)) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Nom invalide'; END IF;
 UPDATE v2_categories SET name=p_new,slug=p_slug WHERE name=p_old;
 IF NOT FOUND THEN RAISE EXCEPTION 'Catégorie absente'; END IF;
 UPDATE products SET category=p_new,updated_at=now() WHERE category=p_old;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n;
END $$;

CREATE OR REPLACE FUNCTION v2_driver_progress(
  p_order_id uuid,p_driver_auth_id text,p_new_status text,p_cash_amount bigint DEFAULT 0,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE d v2_delivery_assignments%ROWTYPE; o orders%ROWTYPE;
BEGIN
 SELECT * INTO d FROM v2_delivery_assignments
 WHERE order_id=p_order_id AND courier_auth_id=p_driver_auth_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Livraison non attribuée'; END IF;
 SELECT * INTO o FROM orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.status='annulee' THEN RAISE EXCEPTION 'Commande indisponible'; END IF;
 IF p_new_status='picked_up' THEN
  IF d.status<>'assigned' OR o.v2_ready_at IS NULL THEN RAISE EXCEPTION 'Colis non prêt'; END IF;
  UPDATE v2_delivery_assignments SET status='picked_up',picked_up_at=now()
  WHERE order_id=p_order_id;
  UPDATE orders SET status='en_livraison',updated_at=now() WHERE id=p_order_id;
 ELSIF p_new_status='delivered' THEN
  IF d.status<>'picked_up' THEN RAISE EXCEPTION 'Prise en charge nécessaire'; END IF;
  IF p_cash_amount<0 OR p_cash_amount>o.total_fc THEN RAISE EXCEPTION 'Montant incorrect'; END IF;
  UPDATE v2_delivery_assignments SET status='delivered',delivered_at=now(),
     cash_collected_fc=p_cash_amount WHERE order_id=p_order_id;
  UPDATE orders SET status='livree',updated_at=now() WHERE id=p_order_id;
 ELSIF p_new_status='failed' THEN
  IF d.status<>'picked_up' OR length(trim(coalesce(p_reason,'')))<5
   THEN RAISE EXCEPTION 'Préciser la raison'; END IF;
  UPDATE v2_delivery_assignments SET status='failed',
    fail_reason=left(p_reason,400) WHERE order_id=p_order_id;
  UPDATE orders SET v2_shipping_status='echec_livraison',updated_at=now()
    WHERE id=p_order_id;
 ELSE RAISE EXCEPTION 'Statut interdit'; END IF;
 INSERT INTO v2_order_events(order_id,actor_auth_id,from_status,to_status,notes)
  VALUES(p_order_id,p_driver_auth_id,o.status,p_new_status,left(coalesce(p_reason,''),400));
 INSERT INTO v2_notifications(user_auth_id,order_id,kind,title)
 SELECT auth_user_id,p_order_id,'status_changed','Livraison : '||o.order_number
 FROM v2_user_roles WHERE enabled AND role IN('admin','gerant');
 IF o.v2_client_auth_id IS NOT NULL THEN
  INSERT INTO v2_notifications(user_auth_id,order_id,kind,title)
  VALUES(o.v2_client_auth_id,p_order_id,'status_changed','Livraison mise à jour');
 END IF;
 RETURN jsonb_build_object('ok',true,'orderNumber',o.order_number,'status',p_new_status);
END $$;
