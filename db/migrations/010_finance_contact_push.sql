-- JorsenShop : suivi de marge brute par vente et boîte de contact.
-- Non destructif. Les coûts d'achat manquants restent NULL (jamais estimés).
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_cost_fc bigint
  CHECK (purchase_cost_fc IS NULL OR purchase_cost_fc >= 0);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_purchase_cost_fc bigint
  CHECK (unit_purchase_cost_fc IS NULL OR unit_purchase_cost_fc >= 0);
CREATE OR REPLACE FUNCTION jorsen_capture_purchase_cost() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT purchase_cost_fc INTO NEW.unit_purchase_cost_fc
    FROM products WHERE id=NEW.product_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS jorsen_order_purchase_cost ON order_items;
CREATE TRIGGER jorsen_order_purchase_cost BEFORE INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION jorsen_capture_purchase_cost();

CREATE TABLE IF NOT EXISTS v2_contact_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 reply_to text NOT NULL CHECK(length(reply_to) BETWEEN 5 AND 200),
 topic text NOT NULL CHECK(length(topic) BETWEEN 3 AND 100),
 message text NOT NULL CHECK(length(message) BETWEEN 10 AND 2500),
 state text NOT NULL DEFAULT 'new' CHECK(state IN ('new','handled')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS v2_contact_state_idx ON v2_contact_messages(state,created_at DESC);
CREATE TABLE IF NOT EXISTS v2_push_subscriptions(
 endpoint text PRIMARY KEY,
 user_auth_id text NOT NULL,
 p256dh text NOT NULL,
 auth_secret text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_used_at timestamptz,
 CHECK(length(endpoint) BETWEEN 40 AND 2048),
 CHECK(length(user_auth_id) BETWEEN 8 AND 200)
);
CREATE INDEX IF NOT EXISTS v2_push_subscriptions_user_idx ON v2_push_subscriptions(user_auth_id);
