-- V2 fulfillment / reconciliation. Development only until final audit.
CREATE TABLE IF NOT EXISTS v2_delivery_assignments (
 order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 courier_auth_id text NOT NULL,
 assigned_by text NOT NULL,
 status text NOT NULL DEFAULT 'assigned'
   CHECK(status IN('assigned','picked_up','delivered','failed')),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 picked_up_at timestamptz,
 delivered_at timestamptz,
 fail_reason text,
 cash_collected_fc bigint NOT NULL DEFAULT 0 CHECK(cash_collected_fc>=0),
 cash_handed_over_fc bigint NOT NULL DEFAULT 0 CHECK(cash_handed_over_fc>=0),
 cash_handed_over_at timestamptz,
 CONSTRAINT cash_handover_check CHECK(cash_handed_over_fc<=cash_collected_fc)
);
CREATE INDEX IF NOT EXISTS v2_delivery_driver_idx
 ON v2_delivery_assignments(courier_auth_id,status,assigned_at);

CREATE TABLE IF NOT EXISTS v2_payment_verifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 verified_by text NOT NULL,
 provider text NOT NULL CHECK(provider IN('airtel_money','orange_money','cash','other')),
 reference text,
 amount_fc bigint NOT NULL CHECK(amount_fc>0),
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS v2_payments_order_idx ON v2_payment_verifications(order_id,verified_at);

CREATE TABLE IF NOT EXISTS v2_order_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 actor_auth_id text,
 from_status text,
 to_status text NOT NULL,
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS v2_events_order_idx ON v2_order_events(order_id,created_at);

CREATE OR REPLACE FUNCTION v2_staff_set_status(p_number text,p_status text,p_actor text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE o orders%ROWTYPE; result jsonb;
BEGIN
 SELECT * INTO o FROM orders WHERE order_number=p_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Commande inexistante'; END IF;
 IF p_status NOT IN ('confirmee','en_preparation','en_livraison','livree','annulee')
 THEN RAISE EXCEPTION 'Statut incorrect'; END IF;
 IF o.status='annulee' OR o.status='livree' THEN RAISE EXCEPTION 'Commande terminée'; END IF;
 IF p_status='confirmee' AND o.status<>'a_confirmer'
 THEN RAISE EXCEPTION 'Confirmer une commande en attente seulement'; END IF;
 IF p_status='en_preparation' AND o.status<>'confirmee'
 THEN RAISE EXCEPTION 'Confirmer avant préparation'; END IF;
 IF p_status='en_livraison' AND (o.status<>'en_preparation' OR o.v2_ready_at IS NULL)
 THEN RAISE EXCEPTION 'Colis non prêt'; END IF;
 IF p_status='livree' AND
  (o.status<>'en_livraison' OR lower(o.delivery_city)='lubumbashi'
   OR o.v2_shipping_status IS DISTINCT FROM 'expediee')
 THEN RAISE EXCEPTION 'Livraison non confirmable'; END IF;
 IF p_status='annulee' AND o.status='en_livraison'
 THEN RAISE EXCEPTION 'Régler la livraison en cours avant annulation'; END IF;
 IF p_status='en_preparation' AND lower(o.delivery_city)<>'lubumbashi'
     AND o.payment_status<>'payee' THEN
    RAISE EXCEPTION 'Payer avant achat et préparation hors Lubumbashi';
 END IF;
 IF p_status='en_livraison' AND lower(o.delivery_city)='lubumbashi'
     AND NOT EXISTS(SELECT 1 FROM v2_delivery_assignments WHERE order_id=o.id
                   AND status IN ('assigned','picked_up')) THEN
    RAISE EXCEPTION 'Livreur non attribué';
 END IF;
 SELECT staff_update_order(p_number,p_status,false) INTO result;
 INSERT INTO v2_order_events(order_id,actor_auth_id,from_status,to_status)
 VALUES(o.id,p_actor,o.status,p_status);
 INSERT INTO v2_notifications(user_auth_id,order_id,kind,title)
 SELECT o.v2_client_auth_id,o.id,'status_changed','Mise à jour de '||p_number
 WHERE o.v2_client_auth_id IS NOT NULL;
 RETURN result;
END $$;

-- Prepaid transactions may ONLY be marked verified by authorized staff after checking receipt.
CREATE OR REPLACE FUNCTION v2_verify_payment(p_number text,p_actor text,p_amount bigint,
 p_provider text,p_reference text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE o orders%ROWTYPE;
BEGIN
 SELECT * INTO o FROM orders WHERE order_number=p_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Commande inexistante'; END IF;
 IF o.status='annulee' THEN RAISE EXCEPTION 'Commande annulée'; END IF;
 IF o.payment_status='payee' THEN RAISE EXCEPTION 'Paiement déjà confirmé'; END IF;
 IF p_amount<>o.total_fc THEN RAISE EXCEPTION 'Montant non conforme'; END IF;
 IF p_provider NOT IN('airtel_money','orange_money','cash','other') THEN RAISE EXCEPTION 'Fournisseur incorrect'; END IF;
 IF lower(o.delivery_city)<>'lubumbashi' AND p_provider NOT IN('airtel_money','orange_money')
 THEN RAISE EXCEPTION 'Mobile Money obligatoire pour cette ville'; END IF;
 UPDATE orders SET payment_status='payee',paid_at=now(),v2_payment_verified_at=now(),
   updated_at=now() WHERE id=o.id;
 INSERT INTO v2_payment_verifications(order_id,verified_by,provider,reference,amount_fc)
 VALUES(o.id,p_actor,p_provider,left(coalesce(p_reference,''),140),p_amount);
 RETURN jsonb_build_object('ok',true,'orderNumber',p_number,'amount',p_amount);
END $$;
