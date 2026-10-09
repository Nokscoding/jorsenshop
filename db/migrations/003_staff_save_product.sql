-- Atomic product/variant/stock write for one Jorsenshop manager.
CREATE OR REPLACE FUNCTION staff_save_product(p jsonb) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  pid text := p->>'id';
  v jsonb; s jsonb; vid text;
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
  IF want_publish AND NOT confirmed THEN RAISE EXCEPTION 'Confirmer les prix avant de publier'; END IF;
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
    FOR s IN SELECT key,value FROM jsonb_each_text(coalesce(v->'stock','{}'::jsonb)) LOOP
       IF length(s->>'key') > 16 OR (s->>'value')::int NOT BETWEEN 0 AND 100000
       THEN RAISE EXCEPTION 'Stock invalide'; END IF;
       total_stock := total_stock + (s->>'value')::int;
       INSERT INTO variant_stock(variant_id,size,quantity) VALUES(vid,s->>'key',(s->>'value')::int)
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
