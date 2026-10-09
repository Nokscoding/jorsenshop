-- Jorsenshop: safe import of the approved V1.1 catalogue as unpublished drafts
CREATE OR REPLACE FUNCTION staff_import_catalogue(p_catalogue jsonb,p_cloud text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
 p jsonb; v jsonb; entry jsonb; imgs jsonb; path text; name text;
 count_p int:=0; count_v int:=0;
BEGIN
 IF p_cloud !~ '^[a-z0-9_-]{3,80}$' OR jsonb_typeof(p_catalogue)<>'array'
     OR jsonb_array_length(p_catalogue) NOT BETWEEN 1 AND 150
 THEN RAISE EXCEPTION 'Catalogue incorrect'; END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(p_catalogue) LOOP
    IF p->>'id' !~ '^js-[a-zA-Z0-9_-]{3,64}$'
     OR length(p->>'name') NOT BETWEEN 2 AND 150
     OR jsonb_typeof(p->'variants')<>'array'
     OR jsonb_array_length(p->'variants') NOT BETWEEN 1 AND 40
    THEN RAISE EXCEPTION 'Produit incorrect'; END IF;
    INSERT INTO products(id,name,category,description,price_fc,tag,sizes,prices_confirmed,is_published)
    VALUES(p->>'id',p->>'name',left(coalesce(p->>'category','Vêtements'),80),
       left(coalesce(p->>'description',''),3000),greatest(0,(p->>'price')::bigint),
       left(coalesce(p->>'tag',''),100),coalesce(p->'sizes','[]'::jsonb),false,false)
    ON CONFLICT(id) DO NOTHING;
    count_p:=count_p+1;
    FOR v IN SELECT value FROM jsonb_array_elements(p->'variants') LOOP
       IF v->>'id' !~ '^js-[a-zA-Z0-9_-]{3,64}-v[a-zA-Z0-9_-]+$'
         OR left(v->>'id',length(p->>'id'))<>p->>'id'
         OR jsonb_typeof(v->'images')<>'array'
       THEN RAISE EXCEPTION 'Variante incorrecte'; END IF;
       imgs:='[]'::jsonb;
       FOR entry IN SELECT value FROM jsonb_array_elements(v->'images') LOOP
          path:=trim(both '"' from entry::text);
          IF path !~ '^assets/products/[0-9]{3}\.webp$'
          THEN RAISE EXCEPTION 'Image incorrecte'; END IF;
          name:=substring(path from '[0-9]{3}\.webp$');
          imgs:=imgs||to_jsonb('https://res.cloudinary.com/'||p_cloud||'/image/upload/jorsenshop/catalog/'||name);
       END LOOP;
       INSERT INTO product_variants(id,product_id,color,images)
       VALUES(v->>'id',p->>'id',left(coalesce(v->>'color','Autre'),80),imgs)
       ON CONFLICT(id) DO NOTHING;
       count_v:=count_v+1;
    END LOOP;
 END LOOP;
 RETURN jsonb_build_object('products',count_p,'variants',count_v,'published',false);
END;
$$;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(identifier,action)
);
CREATE OR REPLACE FUNCTION count_api_action(p_id text,p_action text,p_max int,p_window_min int DEFAULT 15)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_count int;
BEGIN
 INSERT INTO api_rate_limits(identifier,action,started_at,hits)
 VALUES(p_id,p_action,now(),1)
 ON CONFLICT(identifier,action) DO UPDATE SET
  hits=CASE WHEN api_rate_limits.started_at<now()-(p_window_min||' minutes')::interval THEN 1 ELSE api_rate_limits.hits+1 END,
  started_at=CASE WHEN api_rate_limits.started_at<now()-(p_window_min||' minutes')::interval THEN now() ELSE api_rate_limits.started_at END
 RETURNING hits INTO v_count;
 RETURN v_count<=p_max;
END;
$$;
