-- JorsenShop V2 — commandes authentifiées avec remises transactionnelles et livraison.
-- Création additive : n'altère pas la fonction V2 existante.
CREATE OR REPLACE FUNCTION public.place_v2_order_with_promos(
 p_auth_user text, p_customer_name text, p_customer_phone text,
 p_address text, p_city text, p_notes text, p_items jsonb,
 p_idempotency_key text, p_tracking_hash text,
 p_delivery_mode text, p_payment_provider text, p_promo_code text
) RETURNS jsonb
LANGUAGE plpgsql AS $function$
DECLARE
 v_shipping public.v2_shipping_methods%ROWTYPE;
 v_city public.v2_cities%ROWTYPE;
 v_result jsonb;
 v_number text;
 v_total bigint;
 v_existing boolean;
BEGIN
 IF p_auth_user IS NULL OR length(trim(p_auth_user)) < 8 THEN
  RAISE EXCEPTION 'Connexion obligatoire pour commander';
 END IF;
 SELECT * INTO v_city FROM public.v2_cities WHERE code=p_city AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ville non desservie'; END IF;
 SELECT * INTO v_shipping FROM public.v2_shipping_methods
  WHERE city_code=p_city AND code=p_delivery_mode AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Mode de livraison indisponible'; END IF;
 IF v_shipping.prepaid AND p_payment_provider NOT IN ('airtel_money','orange_money') THEN
  RAISE EXCEPTION 'Moyen de paiement requis';
 END IF;
 IF v_city.delivery_type='expedition' AND NOT v_shipping.prepaid THEN
  RAISE EXCEPTION 'Expédition prépayée obligatoire';
 END IF;
 -- Réductions, stock et code promo validés atomiquement par PostgreSQL.
 SELECT public.place_guest_order_promo(
  p_customer_name,p_customer_phone,p_address,v_city.name,p_notes,
  p_items,p_idempotency_key,p_tracking_hash,p_promo_code
 ) INTO v_result;
 v_number:=v_result->>'orderNumber';
 v_existing:=COALESCE((v_result->>'existing')::boolean,false);
 IF v_existing AND NOT EXISTS (
  SELECT 1 FROM public.orders
  WHERE order_number=v_number AND v2_client_auth_id=p_auth_user
   AND v2_delivery_mode=p_delivery_mode
 ) THEN
  RAISE EXCEPTION 'Reprise de commande non autorisée';
 END IF;
 UPDATE public.orders SET
  delivery_fee_fc=v_shipping.fee_fc,
  v2_delivery_mode=p_delivery_mode,
  v2_client_auth_id=p_auth_user,
  v2_payment_provider=CASE WHEN v_shipping.prepaid THEN p_payment_provider ELSE NULL END,
  payment_method=CASE WHEN v_shipping.prepaid THEN 'mobile_money' ELSE 'paiement_livraison' END
 WHERE order_number=v_number
   AND (v2_client_auth_id IS NULL OR v2_client_auth_id=p_auth_user);
 IF NOT FOUND THEN RAISE EXCEPTION 'Conflit de propriétaire de commande'; END IF;
 SELECT total_fc INTO v_total FROM public.orders WHERE order_number=v_number;
 RETURN jsonb_build_object(
   'orderNumber',v_number,'total',v_total,
   'discount',COALESCE((v_result->>'discount')::bigint,0),
   'promoCode',v_result->>'promoCode',
   'deliveryFeeFc',v_shipping.fee_fc,
   'prepaid',v_shipping.prepaid,
   'existing',v_existing
 );
END $function$;