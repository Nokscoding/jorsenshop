-- JorsenShop V2 (development): additions only. Keep the approved V1 tables intact.
-- Run first on a separate Neon development branch. Do not apply to production before full review.
CREATE TABLE IF NOT EXISTS v2_cities (
  code text PRIMARY KEY CHECK(code ~ '^[a-z_]{2,40}$'),
  name text NOT NULL UNIQUE,
  delivery_type text NOT NULL CHECK(delivery_type IN('local','expedition')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
INSERT INTO v2_cities(code,name,delivery_type,sort_order) VALUES
 ('lubumbashi','Lubumbashi','local',1),('likasi','Likasi','expedition',2),
 ('fungurume','Fungurume','expedition',3),('kolwezi','Kolwezi','expedition',4)
ON CONFLICT(code) DO NOTHING;

CREATE TABLE IF NOT EXISTS v2_shipping_methods (
 city_code text NOT NULL REFERENCES v2_cities(code) ON DELETE RESTRICT,
 code text NOT NULL CHECK(code IN ('normal','express','expedition')),
 fee_fc bigint NOT NULL CHECK(fee_fc>=0),
 prepaid boolean NOT NULL,
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(city_code,code)
);
INSERT INTO v2_shipping_methods(city_code,code,fee_fc,prepaid) VALUES
 ('lubumbashi','normal',7000,false),('lubumbashi','express',15000,false),
 ('likasi','expedition',10000,true),('fungurume','expedition',10000,true),
 ('kolwezi','expedition',10000,true)
ON CONFLICT(city_code,code) DO NOTHING;

CREATE TABLE IF NOT EXISTS v2_categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL UNIQUE CHECK(length(trim(name)) BETWEEN 2 AND 80),
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9-]+$'),
 position integer NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO v2_categories(name,slug,position)
SELECT category,lower(regexp_replace(translate(category, 'éèêàùûôïîÉÈÀ','eeeauuoiiEEA'),'[^a-zA-Z0-9]+','-','g')),
 row_number() OVER(ORDER BY category)::int
FROM (SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> '') x
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS v2_user_roles (
 auth_user_id text NOT NULL,
 role text NOT NULL CHECK(role IN ('admin','gerant','investisseur','livreur')),
 enabled boolean NOT NULL DEFAULT true,
 granted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(auth_user_id,role)
);
CREATE INDEX IF NOT EXISTS v2_roles_enabled_idx ON v2_user_roles(role) WHERE enabled;

CREATE TABLE IF NOT EXISTS v2_customer_profiles (
 auth_user_id text PRIMARY KEY,
 email text NOT NULL,
 full_name text NOT NULL DEFAULT '',
 city_code text REFERENCES v2_cities(code),
 phone text NOT NULL DEFAULT '',
 address text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS v2_client_auth_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS v2_delivery_mode text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS v2_payment_provider text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS v2_payment_verified_at timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS v2_shipping_agency text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS v2_tracking_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS v2_shipping_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS v2_ready_at timestamptz;
CREATE INDEX IF NOT EXISTS v2_orders_client_idx ON orders(v2_client_auth_id,created_at DESC);

CREATE TABLE IF NOT EXISTS v2_order_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 auth_user_id text NOT NULL,
 sender_type text NOT NULL CHECK(sender_type IN ('client','staff')),
 message text NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS v2_messages_order_idx ON v2_order_messages(order_id,created_at);

CREATE TABLE IF NOT EXISTS v2_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_auth_id text NOT NULL,
 order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('new_order','new_message','status_changed','delivery_assigned')),
 title text NOT NULL,
 is_read boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS v2_notifications_user_idx ON v2_notifications(user_auth_id,is_read,created_at DESC);

CREATE OR REPLACE FUNCTION v2_notify_new_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO v2_notifications(user_auth_id,order_id,kind,title)
 SELECT auth_user_id,NEW.id,'new_order','Nouvelle commande '||NEW.order_number
 FROM v2_user_roles WHERE role IN('admin','gerant') AND enabled;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS v2_notify_order_insert ON orders;
CREATE TRIGGER v2_notify_order_insert AFTER INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION v2_notify_new_order();

-- Existing database checkout handles stock and item prices atomically.
-- V2 wrapper uses trusted shipping table, not price/mode/fee supplied by the client.
CREATE OR REPLACE FUNCTION place_v2_order(
 p_auth_user text, p_customer_name text, p_customer_phone text,
 p_address text,p_city text,p_notes text,
 p_items jsonb,p_idempotency_key text,p_tracking_hash text,p_delivery_mode text,p_payment_provider text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_shipping v2_shipping_methods%ROWTYPE;
 v_result jsonb; v_number text; v_fee bigint; v_city v2_cities%ROWTYPE;
BEGIN
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
 UPDATE orders SET delivery_fee_fc=v_shipping.fee_fc,
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

-- Optional naming correction: a "quarter-zip" is better known commercially than "col camionneur".
UPDATE products SET name='Pull quarter-zip torsadé',updated_at=now()
WHERE id='js-001' AND name='Pull torsadé col camionneur';
