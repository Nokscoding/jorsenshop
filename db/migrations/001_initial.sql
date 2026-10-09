-- Jorsenshop · Migration initiale PostgreSQL pour Neon
-- Exécuter dans la base NEON DÉDIÉE à Jorsenshop (jamais One Market / NKS).
-- Montants FC : BIGINT (entiers), pas de flottants.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  password_hash TEXT,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'client'
    CHECK (role IN ('client','admin','investisseur','livreur')),
  email_verified_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(lower(email));

CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Adresse',
  street_address TEXT NOT NULL,
  district TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Lubumbashi',
  details TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_fc BIGINT NOT NULL CHECK (price_fc >= 0),
  prices_confirmed BOOLEAN NOT NULL DEFAULT false,
  tag TEXT NOT NULL DEFAULT '',
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sizes)='array'),
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category) WHERE is_published;

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT NOT NULL,
  sku TEXT UNIQUE,
  images JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(images)='array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS variant_stock (
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= quantity),
  PRIMARY KEY (variant_id, size)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_city TEXT NOT NULL DEFAULT 'Lubumbashi',
  delivery_notes TEXT NOT NULL DEFAULT '',
  item_subtotal_fc BIGINT NOT NULL CHECK (item_subtotal_fc >= 0),
  delivery_fee_fc BIGINT NOT NULL DEFAULT 0 CHECK (delivery_fee_fc >= 0),
  total_fc BIGINT GENERATED ALWAYS AS (item_subtotal_fc + delivery_fee_fc) STORED,
  status TEXT NOT NULL DEFAULT 'a_confirmer'
    CHECK (status IN ('a_confirmer','confirmee','en_preparation','en_livraison','livree','annulee')),
  payment_status TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (payment_status IN ('en_attente','partiellement_payee','payee','remboursee')),
  payment_method TEXT NOT NULL DEFAULT 'paiement_livraison'
    CHECK (payment_method IN ('paiement_livraison','mobile_money','virement','autre')),
  paid_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders(customer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status,created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  selected_color TEXT NOT NULL,
  selected_size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_fc BIGINT NOT NULL CHECK (unit_price_fc >= 0),
  line_total_fc BIGINT GENERATED ALWAYS AS (quantity * unit_price_fc) STORED
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  amount_fc BIGINT NOT NULL CHECK (amount_fc > 0),
  method TEXT NOT NULL CHECK (method IN ('cash','mobile_money','virement','autre')),
  external_reference TEXT,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id);

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  courier_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (status IN ('en_attente','assignee','en_cours','terminee','echec')),
  assigned_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  courier_note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS deliveries_courier_idx ON deliveries(courier_id,status);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_order_idx ON messages(order_id,created_at);

CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ouverte'
    CHECK (status IN ('ouverte','en_examen','approuvee','refusee','remboursee')),
  requested_fc BIGINT CHECK (requested_fc >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'autre',
  amount_fc BIGINT NOT NULL CHECK (amount_fc >= 0),
  incurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revenue_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  basis TEXT NOT NULL DEFAULT 'produits_encaisses_hors_livraison'
    CHECK (basis IN ('produits_encaisses_hors_livraison')),
  starts_on DATE,
  ends_on DATE,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Aucun accord de 30 % n'est créé automatiquement : validation contractuelle requise.

CREATE TABLE IF NOT EXISTS promo_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_url TEXT NOT NULL,
  eyebrow TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  destination TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reporting indicatif : exclut les frais de livraison et les commandes non payées.
-- Le contrôle des encaissements devra être assuré par des transactions serveur.
CREATE OR REPLACE VIEW paid_product_sales AS
SELECT date_trunc('month', paid_at) AS month,
       COUNT(*) AS paid_orders,
       SUM(item_subtotal_fc) AS product_sales_fc
FROM orders
WHERE payment_status = 'payee' AND paid_at IS NOT NULL
GROUP BY date_trunc('month', paid_at);
