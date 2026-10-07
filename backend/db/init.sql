-- =============================================================
-- POS mini-market -- TODO el acceso a datos es via STORED PROCEDURES.
-- La API conecta con el rol `pos`, que NO tiene permisos directos
-- sobre las tablas (solo EXECUTE en las funciones SECURITY DEFINER).
-- Tablas + procedimientos + seed. Idempotente: se puede ejecutar
-- varias veces (docker-entrypoint-initdb.d y job db-init).
-- =============================================================

-- ---------- Tablas ----------
CREATE TABLE IF NOT EXISTS users (
  id                 SERIAL PRIMARY KEY,
  username           VARCHAR(50)  NOT NULL UNIQUE,
  full_name          VARCHAR(120) NOT NULL DEFAULT '',
  password_hash      VARCHAR(255) NOT NULL,
  role               VARCHAR(20)  NOT NULL DEFAULT 'cliente'
                     CHECK (role IN ('admin','cliente')),
  first_purchase_done BOOLEAN NOT NULL DEFAULT FALSE,
  disabled           BOOLEAN NOT NULL DEFAULT FALSE,
  email              VARCHAR(120) NOT NULL DEFAULT '',
  address            VARCHAR(200) NOT NULL DEFAULT ''
);
-- Migracion: cuentas creadas antes del correo/direccion
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(200);
UPDATE users SET email = '' WHERE email IS NULL;
UPDATE users SET address = '' WHERE address IS NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ALTER COLUMN address SET NOT NULL;

CREATE TABLE IF NOT EXISTS products (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(120) NOT NULL,
  sku   VARCHAR(50)  NOT NULL UNIQUE,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category VARCHAR(60) NOT NULL DEFAULT 'General'
);
-- Migracion: si la tabla ya existia sin categoria
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(60);
ALTER TABLE products ALTER COLUMN category SET DEFAULT 'General';
UPDATE products SET category = 'General' WHERE category IS NULL;
ALTER TABLE products ALTER COLUMN category SET NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
UPDATE products SET image_url = '' WHERE image_url IS NULL;
ALTER TABLE products ALTER COLUMN image_url SET DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
UPDATE products SET description = '' WHERE description IS NULL;
ALTER TABLE products ALTER COLUMN description SET DEFAULT '';

CREATE TABLE IF NOT EXISTS sales (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  buyer_name VARCHAR(120) NOT NULL DEFAULT 'invitado',
  subtotal   NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detalle    TEXT NOT NULL DEFAULT ''
);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS detalle TEXT;
UPDATE sales SET detalle = '' WHERE detalle IS NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS iva NUMERIC(12,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
UPDATE sales SET iva = 0 WHERE iva IS NULL;
UPDATE sales SET payment_method = 'efectivo' WHERE payment_method IS NULL;
ALTER TABLE sales ALTER COLUMN iva SET DEFAULT 0;
ALTER TABLE sales ALTER COLUMN payment_method SET DEFAULT 'efectivo';

-- Migracion: se elimina el rol cajero (el sistema avisa solo al admin).
DROP FUNCTION IF EXISTS sp_report_stock(INT,INT);
DROP FUNCTION IF EXISTS sp_list_reports(TEXT);
DROP FUNCTION IF EXISTS sp_resolve_report(INT);
DROP TABLE IF EXISTS stock_reports;
DELETE FROM users WHERE role = 'cajero';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin','cliente'));

-- Departamentos/areas de la tienda (el admin elige uno al dar de alta)
CREATE TABLE IF NOT EXISTS departments (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(60) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  prefix VARCHAR(10) NOT NULL DEFAULT ''
);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS prefix VARCHAR(10);
UPDATE departments SET prefix = 'ALI' WHERE name = 'Alimentos y Abarrotes' AND (prefix IS NULL OR prefix = '');
UPDATE departments SET prefix = 'BEB' WHERE name = 'Bebidas y Botanas' AND (prefix IS NULL OR prefix = '');
UPDATE departments SET prefix = 'HIG' WHERE name = 'Higiene y Limpieza' AND (prefix IS NULL OR prefix = '');
UPDATE departments SET prefix = 'LAC' WHERE name = 'Lacteos y Frescos' AND (prefix IS NULL OR prefix = '');

CREATE OR REPLACE FUNCTION sp_list_departments()
RETURNS TABLE (o_id INT, o_name VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT d.id, d.name FROM departments d
               WHERE d.active ORDER BY d.name;
END;
$$;

-- Departamentos con total de productos (para el popup de descuentos)
CREATE OR REPLACE FUNCTION sp_departments_with_counts()
RETURNS TABLE (o_id INT, o_name VARCHAR, o_products BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT d.id, d.name, COUNT(p.id)
               FROM departments d LEFT JOIN products p ON p.category = d.name
               WHERE d.active GROUP BY d.id ORDER BY d.name;
END;
$$;

-- SKU automatico: PREFIJO-NOMBRE-STOCK (unico; sufijo -2, -3 si choca)
CREATE OR REPLACE FUNCTION sp_make_sku(p_dept TEXT, p_name TEXT,
                                       p_stock INT, p_exclude_id INT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_slug TEXT; v_pfx TEXT; v_base TEXT; v_try TEXT; v_n INT := 1;
BEGIN
  SELECT d.prefix INTO v_pfx FROM departments d WHERE d.name = p_dept;
  v_pfx := COALESCE(NULLIF(v_pfx,''), 'PROD');
  v_slug := upper(substring(regexp_replace(COALESCE(p_name,''),
                             '[^A-Za-z0-9]', '', 'g') from 1 for 12));
  IF v_slug = '' THEN v_slug := 'PROD'; END IF;
  v_base := v_pfx || '-' || v_slug || '-' || GREATEST(p_stock, 0);
  v_try := v_base;
  WHILE EXISTS (SELECT 1 FROM products p WHERE p.sku = v_try
                AND (p_exclude_id IS NULL OR p.id <> p_exclude_id)) LOOP
    v_n := v_n + 1;
    v_try := v_base || '-' || v_n;
  END LOOP;
  RETURN v_try;
END;
$$;

-- Descuentos del admin por seccion o producto (activos/inactivos)
CREATE TABLE IF NOT EXISTS discounts (
  id      SERIAL PRIMARY KEY,
  scope   VARCHAR(20) NOT NULL CHECK (scope IN ('seccion','producto')),
  target  VARCHAR(60) NOT NULL,
  percent NUMERIC(5,2) NOT NULL CHECK (percent > 0 AND percent <= 90),
  active  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (scope, target)
);

-- Apartados de carrito: stock reservado al agregar al carrito para que
-- dos clientes no compren lo mismo (nunca queda en -1). Expiran en 30 min.
CREATE TABLE IF NOT EXISTS reservations (
  holder     VARCHAR(80) NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (holder, product_id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id         SERIAL PRIMARY KEY,
  sale_id    INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0)
);

-- ---------- Rol de aplicacion (minimo privilegio) ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pos') THEN
    CREATE ROLE pos LOGIN PASSWORD 'pos123';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE posdb TO pos;
GRANT USAGE ON SCHEMA public TO pos;
-- Sin GRANTs sobre tablas: `pos` solo puede llamar a los procedimientos.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM pos;

-- ---------- Procedimientos: usuarios ----------
CREATE OR REPLACE FUNCTION sp_get_user_by_username(p_username TEXT)
RETURNS TABLE (o_id INT, o_username VARCHAR, o_full_name VARCHAR,
               o_password_hash VARCHAR, o_role VARCHAR,
               o_first_purchase_done BOOLEAN, o_disabled BOOLEAN,
               o_email VARCHAR, o_address VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT u.id, u.username, u.full_name, u.password_hash,
                      u.role, u.first_purchase_done, u.disabled,
                      u.email, u.address
               FROM users u WHERE u.username = p_username;
END;
$$;

DROP FUNCTION IF EXISTS sp_create_user(TEXT,TEXT,TEXT,TEXT);
CREATE OR REPLACE FUNCTION sp_create_user(p_username TEXT, p_full_name TEXT,
                                          p_password_hash TEXT, p_role TEXT,
                                          p_email TEXT DEFAULT '')
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id INT;
BEGIN
  IF p_role NOT IN ('admin','cliente') THEN
    RAISE EXCEPTION 'ROL_INVALIDO:%', p_role;
  END IF;
  IF p_email <> '' AND NOT p_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'EMAIL_INVALIDO:%', p_email;
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE username = p_username) THEN
    RAISE EXCEPTION 'USUARIO_EXISTE:%', p_username;
  END IF;
  IF p_email <> '' AND EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
    RAISE EXCEPTION 'EMAIL_EXISTE:%', p_email;
  END IF;
  INSERT INTO users(username, full_name, password_hash, role, email)
  VALUES (p_username, p_full_name, p_password_hash, p_role, p_email)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION sp_list_users()
RETURNS TABLE (o_id INT, o_username VARCHAR, o_full_name VARCHAR,
               o_role VARCHAR, o_first_purchase_done BOOLEAN,
               o_disabled BOOLEAN, o_email VARCHAR, o_address VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT u.id, u.username, u.full_name, u.role,
                      u.first_purchase_done, u.disabled, u.email, u.address
               FROM users u ORDER BY u.id;
END;
$$;

-- Ajustes del engrane: nombre, correo y direccion de entrega
CREATE OR REPLACE FUNCTION sp_update_profile(p_user_id INT, p_full_name TEXT,
                                             p_email TEXT, p_address TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_email <> '' AND NOT p_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'EMAIL_INVALIDO:%', p_email;
  END IF;
  IF p_email <> '' AND EXISTS (SELECT 1 FROM users
                               WHERE email = p_email AND id <> p_user_id) THEN
    RAISE EXCEPTION 'EMAIL_EXISTE:%', p_email;
  END IF;
  UPDATE users SET full_name = p_full_name, email = p_email,
                   address = p_address
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USUARIO_NO_EXISTE:%', p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sp_set_password(p_user_id INT, p_password_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE users SET password_hash = p_password_hash WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USUARIO_NO_EXISTE:%', p_user_id;
  END IF;
END;
$$;

-- ---------- Procedimientos: productos ----------
DROP FUNCTION IF EXISTS sp_list_products();
CREATE OR REPLACE FUNCTION sp_list_products()
RETURNS TABLE (o_id INT, o_name VARCHAR, o_sku VARCHAR,
               o_price NUMERIC, o_stock INT, o_category VARCHAR,
               o_desc NUMERIC, o_image TEXT, o_features TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT p.id, p.name, p.sku, p.price, p.stock, p.category,
                      sp_product_discount(p.sku, p.category), p.image_url,
                      p.description
               FROM products p ORDER BY p.category, p.id;
END;
$$;

-- Solo existencias (lo que ve el cliente)
DROP FUNCTION IF EXISTS sp_list_products_available();
CREATE OR REPLACE FUNCTION sp_list_products_available()
RETURNS TABLE (o_id INT, o_name VARCHAR, o_sku VARCHAR,
               o_price NUMERIC, o_stock INT, o_category VARCHAR,
               o_desc NUMERIC, o_image TEXT, o_features TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT p.id, p.name, p.sku, p.price, p.stock, p.category,
                      sp_product_discount(p.sku, p.category), p.image_url,
                      p.description
               FROM products p WHERE p.stock > 0
               ORDER BY p.category, p.id;
END;
$$;

DROP FUNCTION IF EXISTS sp_create_product(TEXT,TEXT,NUMERIC,INT);
DROP FUNCTION IF EXISTS sp_create_product(TEXT,TEXT,NUMERIC,INT,TEXT);
DROP FUNCTION IF EXISTS sp_create_product(TEXT,TEXT,NUMERIC,INT,TEXT,TEXT);
DROP FUNCTION IF EXISTS sp_create_product(TEXT,TEXT,NUMERIC,INT,TEXT,TEXT,TEXT);
CREATE OR REPLACE FUNCTION sp_create_product(p_name TEXT, p_sku TEXT,
                                             p_price NUMERIC, p_stock INT,
                                             p_category TEXT DEFAULT 'General',
                                             p_image_url TEXT DEFAULT '',
                                             p_description TEXT DEFAULT '')
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id INT;
BEGIN
  IF p_price < 0 OR p_stock < 0 THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS:precio/stock negativos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM departments
                 WHERE name = p_category AND active) THEN
    RAISE EXCEPTION 'DEPARTAMENTO_INVALIDO:%', p_category;
  END IF;
  IF p_image_url <> '' AND (length(p_image_url) > 500
      OR (p_image_url !~ '^https?://\S+$'
          AND p_image_url !~ '^/images/[A-Za-z0-9._-]+$')) THEN
    RAISE EXCEPTION 'IMAGEN_INVALIDA:url http(s) o /images/... max 500';
  END IF;
  -- SKU autoasignado (depto + producto + stock) si no se envia uno
  IF p_sku IS NULL OR p_sku = '' THEN
    p_sku := sp_make_sku(p_category, p_name, p_stock, NULL);
  ELSIF EXISTS (SELECT 1 FROM products WHERE sku = p_sku) THEN
    RAISE EXCEPTION 'SKU_EXISTE:%', p_sku;
  END IF;
  INSERT INTO products(name, sku, price, stock, category, image_url,
                       description)
  VALUES (p_name, p_sku, p_price, p_stock, p_category,
          COALESCE(p_image_url,''), COALESCE(p_description,''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Edicion admin: nombre, precio, imagen y caracteristicas (NULL = sin cambio).
-- El SKU se reasigna solo (depto + producto + stock) y los descuentos
-- por producto siguen al nuevo SKU.
DROP FUNCTION IF EXISTS sp_update_product(INT,TEXT,NUMERIC,TEXT);
DROP FUNCTION IF EXISTS sp_update_product(INT,TEXT,NUMERIC,TEXT,TEXT);
CREATE OR REPLACE FUNCTION sp_update_product(p_id INT, p_name TEXT DEFAULT NULL,
                                             p_price NUMERIC DEFAULT NULL,
                                             p_image_url TEXT DEFAULT NULL,
                                             p_description TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_old TEXT; v_new TEXT;
BEGIN
  SELECT p.sku INTO v_old FROM products p WHERE p.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_EXISTE:%', p_id;
  END IF;
  IF p_name IS NOT NULL AND (p_name = '' OR length(p_name) > 120) THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS:nombre';
  END IF;
  IF p_price IS NOT NULL AND p_price < 0 THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS:precio';
  END IF;
  IF p_image_url IS NOT NULL AND p_image_url <> ''
     AND (length(p_image_url) > 500
          OR (p_image_url !~ '^https?://\S+$'
              AND p_image_url !~ '^/images/[A-Za-z0-9._-]+$')) THEN
    RAISE EXCEPTION 'IMAGEN_INVALIDA:url http(s) o /images/... max 500';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 300 THEN
    RAISE EXCEPTION 'DATOS_INVALIDOS:caracteristicas max 300';
  END IF;
  UPDATE products
  SET name = COALESCE(p_name, name),
      price = COALESCE(p_price, price),
      image_url = COALESCE(p_image_url, image_url),
      description = COALESCE(p_description, description)
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_EXISTE:%', p_id;
  END IF;
  -- Reasigna SKU automatico y migra descuentos por producto al nuevo SKU
  UPDATE products p
  SET sku = sp_make_sku(p.category, p.name, p.stock, p.id)
  WHERE p.id = p_id;
  SELECT p.sku INTO v_new FROM products p WHERE p.id = p_id;
  IF v_old IS DISTINCT FROM v_new THEN
    UPDATE discounts SET target = v_new
    WHERE scope = 'producto' AND target = v_old;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS sp_set_stock(INT,INT);
CREATE OR REPLACE FUNCTION sp_set_stock(p_product_id INT, p_stock INT)
RETURNS TABLE (o_id INT, o_name VARCHAR, o_sku VARCHAR,
               o_price NUMERIC, o_stock INT, o_category VARCHAR,
               o_desc NUMERIC, o_image TEXT, o_features TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_stock < 0 THEN
    RAISE EXCEPTION 'STOCK_INVALIDO:negativo';
  END IF;
  UPDATE products SET stock = p_stock WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_EXISTE:%', p_product_id;
  END IF;
  RETURN QUERY SELECT p.id, p.name, p.sku, p.price, p.stock, p.category,
                      sp_product_discount(p.sku, p.category), p.image_url,
                      p.description
               FROM products p WHERE p.id = p_product_id;
END;
$$;

-- ---------- Carrito: reserva de stock al agregar ----------
-- Devuelve expiradas a stock (>30 min) en cada operacion.
CREATE OR REPLACE FUNCTION sp_cleanup_reservations()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE products p SET stock = stock + r.qty
  FROM reservations r
  WHERE r.product_id = p.id AND r.updated_at < now() - interval '30 minutes';
  DELETE FROM reservations WHERE updated_at < now() - interval '30 minutes';
END;
$$;

-- Aparta stock al agregar al carrito (evita compras duplicadas / -1)
CREATE OR REPLACE FUNCTION sp_reserve_stock(p_holder TEXT, p_product_id INT,
                                            p_qty INT)
RETURNS TABLE (o_stock INT, o_reserved INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_stock INT; v_cur INT;
BEGIN
  IF p_qty <= 0 OR p_qty > 999 THEN
    RAISE EXCEPTION 'CANTIDAD_INVALIDA:%', p_product_id;
  END IF;
  PERFORM sp_cleanup_reservations();
  SELECT p.stock INTO v_stock FROM products p
    WHERE p.id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_EXISTE:%', p_product_id;
  END IF;
  IF v_stock < p_qty THEN
    RAISE EXCEPTION 'SIN_STOCK:quedan %', v_stock;
  END IF;
  UPDATE products SET stock = stock - p_qty WHERE id = p_product_id;
  INSERT INTO reservations(holder, product_id, qty)
  VALUES (p_holder, p_product_id, p_qty)
  ON CONFLICT (holder, product_id)
  DO UPDATE SET qty = reservations.qty + EXCLUDED.qty,
                updated_at = now();
  SELECT r.qty INTO v_cur FROM reservations r
    WHERE r.holder = p_holder AND r.product_id = p_product_id;
  SELECT p.stock INTO v_stock FROM products p WHERE p.id = p_product_id;
  RETURN QUERY SELECT v_stock, v_cur;
END;
$$;

-- Libera stock al quitar del carrito (una parte, una linea o todo con p_qty NULL)
CREATE OR REPLACE FUNCTION sp_release_stock(p_holder TEXT, p_product_id INT,
                                            p_qty INT DEFAULT NULL)
RETURNS TABLE (o_stock INT, o_reserved INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_res INT; v_back INT; v_stock INT;
BEGIN
  PERFORM sp_cleanup_reservations();
  SELECT r.qty INTO v_res FROM reservations r
    WHERE r.holder = p_holder AND r.product_id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT p.stock INTO v_stock FROM products p WHERE p.id = p_product_id;
    RETURN QUERY SELECT v_stock, 0;
    RETURN;
  END IF;
  v_back := COALESCE(p_qty, v_res);
  IF v_back <= 0 OR v_back > v_res THEN
    RAISE EXCEPTION 'CANTIDAD_INVALIDA:%', p_product_id;
  END IF;
  IF v_back = v_res THEN
    DELETE FROM reservations
      WHERE holder = p_holder AND product_id = p_product_id;
    v_res := 0;
  ELSE
    UPDATE reservations SET qty = qty - v_back, updated_at = now()
      WHERE holder = p_holder AND product_id = p_product_id;
    v_res := v_res - v_back;
  END IF;
  UPDATE products SET stock = stock + v_back WHERE id = p_product_id;
  SELECT p.stock INTO v_stock FROM products p WHERE p.id = p_product_id;
  RETURN QUERY SELECT v_stock, v_res;
END;
$$;

-- ---------- Vista previa del ticket (sin mover stock) ----------
-- Lo que ve el carrito conforme agrega: subtotal, descuentos, IVA 16%, total.
DROP FUNCTION IF EXISTS sp_cart_preview(INT,JSONB,NUMERIC);
CREATE OR REPLACE FUNCTION sp_cart_preview(p_user_id INT, p_items JSONB,
                                           p_discount_rate NUMERIC)
RETURNS TABLE (o_subtotal NUMERIC, o_admin_disc NUMERIC,
               o_first_disc NUMERIC, o_discount NUMERIC,
               o_iva NUMERIC, o_total NUMERIC, o_detalle TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  it         RECORD;
  v_price    NUMERIC;
  v_pname    VARCHAR;
  v_sku      VARCHAR;
  v_cat      VARCHAR;
  v_pct      NUMERIC;
  v_qty      INT;
  v_role     VARCHAR;
  v_first    BOOLEAN;
  v_subtotal NUMERIC := 0;
  v_admin    NUMERIC := 0;
  v_first_d  NUMERIC := 0;
  v_fdesc    TEXT := '';
  v_detalle  TEXT := '';
  v_base     NUMERIC;
  v_iva      NUMERIC;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'CARRITO_VACIO';
  END IF;
  IF p_user_id IS NOT NULL THEN
    SELECT u.role, u.first_purchase_done INTO v_role, v_first
      FROM users u WHERE u.id = p_user_id;
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((it.value ->> 'qty')::INT, 1);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'CANTIDAD_INVALIDA';
    END IF;
    SELECT p.price, p.name, p.sku, p.category
      INTO v_price, v_pname, v_sku, v_cat
      FROM products p WHERE p.id = (it.value ->> 'product_id')::INT;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCTO_NO_EXISTE';
    END IF;
    SELECT sp_product_discount(v_sku, v_cat) INTO v_pct;
    IF v_pct > 0 THEN
      v_admin := v_admin + ROUND(v_price * v_qty * v_pct / 100, 2);
      v_fdesc := v_fdesc || v_pct || '% ' || v_pname || '; ';
    END IF;
    v_subtotal := v_subtotal + v_price * v_qty;
  END LOOP;
  IF p_user_id IS NOT NULL AND v_role = 'cliente'
     AND v_first = FALSE AND p_discount_rate > 0 THEN
    v_first_d := ROUND((v_subtotal - v_admin) * p_discount_rate, 2);
    v_detalle := v_fdesc || '15% primera compra';
  ELSE
    v_detalle := v_fdesc;
  END IF;
  v_base := ROUND(v_subtotal - v_admin - v_first_d, 2);
  v_iva := ROUND(v_base * 0.16, 2);
  RETURN QUERY SELECT ROUND(v_subtotal,2), ROUND(v_admin,2), v_first_d,
                      ROUND(v_admin + v_first_d,2), v_iva,
                      ROUND(v_base + v_iva,2), v_detalle;
END;
$$;

-- Carrito persistente: lo apartado por un holder (sobrevive navegacion/logout)
CREATE OR REPLACE FUNCTION sp_my_reservations(p_holder TEXT)
RETURNS TABLE (o_product_id INT, o_qty INT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM sp_cleanup_reservations();
  RETURN QUERY SELECT r.product_id, r.qty FROM reservations r
               WHERE r.holder = p_holder ORDER BY r.product_id;
END;
$$;

-- Migra el carrito de invitado (g:xxx) a la cuenta (u:user) al iniciar sesion
CREATE OR REPLACE FUNCTION sp_move_reservations(p_from TEXT, p_to TEXT)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_moved INT := 0; rec RECORD;
BEGIN
  PERFORM sp_cleanup_reservations();
  FOR rec IN SELECT r.product_id, r.qty FROM reservations r
             WHERE r.holder = p_from LOOP
    INSERT INTO reservations(holder, product_id, qty)
    VALUES (p_to, rec.product_id, rec.qty)
    ON CONFLICT (holder, product_id)
    DO UPDATE SET qty = reservations.qty + EXCLUDED.qty,
                  updated_at = now();
    DELETE FROM reservations
      WHERE holder = p_from AND product_id = rec.product_id;
    v_moved := v_moved + 1;
  END LOOP;
  RETURN v_moved;
END;
$$;

-- ---------- Procedimiento: venta (consume reservas, 15% 1ra compra) ----------
-- p_items: JSONB [{"product_id":1,"qty":2}, ...]
DROP FUNCTION IF EXISTS sp_checkout(INT,TEXT,JSONB,NUMERIC);
DROP FUNCTION IF EXISTS sp_checkout(INT,TEXT,JSONB,NUMERIC,TEXT);
DROP FUNCTION IF EXISTS sp_checkout(INT,TEXT,JSONB,NUMERIC,TEXT,TEXT);
CREATE OR REPLACE FUNCTION sp_checkout(p_user_id INT, p_buyer_name TEXT,
                                       p_items JSONB, p_discount_rate NUMERIC,
                                       p_holder TEXT DEFAULT '',
                                       p_pay_method TEXT DEFAULT 'efectivo')
RETURNS TABLE (o_sale_id INT, o_subtotal NUMERIC,
               o_discount NUMERIC, o_iva NUMERIC,
               o_total NUMERIC, o_detalle TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  it         RECORD;
  v_pid      INT;
  v_qty      INT;
  v_price    NUMERIC;
  v_pname    VARCHAR;
  v_stock    INT;
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_total    NUMERIC;
  v_sale_id  INT;
  v_role     VARCHAR;
  v_first    BOOLEAN;
  v_resv     INT;
  v_sku      VARCHAR;
  v_cat      VARCHAR;
  v_pct      NUMERIC;
  v_full_qty INT;
  v_admin    NUMERIC := 0;
  v_fdesc    TEXT := '';
  v_detalle  TEXT := '';
  v_base     NUMERIC;
  v_iva      NUMERIC;
BEGIN
  IF p_pay_method NOT IN ('efectivo','tarjeta_debito','tarjeta_credito',
                          'transferencia') THEN
    RAISE EXCEPTION 'PAGO_INVALIDO:%', p_pay_method;
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'CARRITO_VACIO';
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT u.role, u.first_purchase_done INTO v_role, v_first
      FROM users u WHERE u.id = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'USUARIO_NO_EXISTE:%', p_user_id;
    END IF;
  END IF;

  PERFORM sp_cleanup_reservations();
  -- Consume lo apartado en el carrito; el resto se descuenta con validacion
  -- (bloqueo de fila, todo atomico; el stock jamas queda negativo).
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (it.value ->> 'product_id')::INT;
    v_qty := COALESCE((it.value ->> 'qty')::INT, 1);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'CANTIDAD_INVALIDA:%', v_pid;
    END IF;
    SELECT p.price, p.name, p.stock, p.sku, p.category
      INTO v_price, v_pname, v_stock, v_sku, v_cat
      FROM products p WHERE p.id = v_pid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCTO_NO_EXISTE:%', v_pid;
    END IF;
    -- Descuento admin vigente (mayor entre producto y seccion)
    SELECT sp_product_discount(v_sku, v_cat) INTO v_pct;
    v_full_qty := (it.value ->> 'qty')::INT;
    IF v_pct > 0 THEN
      v_admin := v_admin + ROUND(v_price * v_full_qty * v_pct / 100, 2);
      v_fdesc := v_fdesc || v_pct || '% ' || v_pname || '; ';
    END IF;
    IF p_holder <> '' THEN
      SELECT r.qty INTO v_resv FROM reservations r
        WHERE r.holder = p_holder AND r.product_id = v_pid FOR UPDATE;
      IF FOUND THEN
        IF v_resv >= v_qty THEN
          IF v_resv = v_qty THEN
            DELETE FROM reservations
              WHERE holder = p_holder AND product_id = v_pid;
          ELSE
            UPDATE reservations SET qty = qty - v_qty,
                   updated_at = now()
              WHERE holder = p_holder AND product_id = v_pid;
          END IF;
          v_qty := 0;
        ELSE
          DELETE FROM reservations
            WHERE holder = p_holder AND product_id = v_pid;
          v_qty := v_qty - v_resv;
        END IF;
      END IF;
    END IF;
    IF v_qty > 0 THEN
      IF v_stock < v_qty THEN
        RAISE EXCEPTION 'SIN_STOCK:%:quedan %', v_pname, v_stock;
      END IF;
      UPDATE products SET stock = stock - v_qty WHERE id = v_pid;
    END IF;
    v_subtotal := v_subtotal + v_price * (it.value ->> 'qty')::INT;
  END LOOP;

  -- 15% solo en la 1ra compra del cliente registrado (sobre lo ya rebajado)
  IF p_user_id IS NOT NULL AND v_role = 'cliente'
     AND v_first = FALSE AND p_discount_rate > 0 THEN
    v_discount := ROUND((v_subtotal - v_admin) * p_discount_rate, 2);
    UPDATE users SET first_purchase_done = TRUE WHERE id = p_user_id;
    v_detalle := v_fdesc || '15% primera compra';
  ELSE
    v_detalle := v_fdesc;
  END IF;
  v_discount := ROUND(v_admin + v_discount, 2);

  v_base := ROUND(v_subtotal - v_discount, 2);
  v_iva := ROUND(v_base * 0.16, 2);
  v_total := ROUND(v_base + v_iva, 2);
  INSERT INTO sales(user_id, buyer_name, subtotal, discount, iva, total,
                    detalle, payment_method)
  VALUES (p_user_id, COALESCE(p_buyer_name,'invitado'),
          ROUND(v_subtotal,2), v_discount, v_iva, v_total, v_detalle,
          p_pay_method)
  RETURNING id INTO v_sale_id;

  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid := (it.value ->> 'product_id')::INT;
    v_qty := COALESCE((it.value ->> 'qty')::INT, 1);
    SELECT p.price INTO v_price FROM products p WHERE p.id = v_pid;
    INSERT INTO sale_items(sale_id, product_id, qty, unit_price)
    VALUES (v_sale_id, v_pid, v_qty, v_price);
  END LOOP;

  RETURN QUERY SELECT v_sale_id, ROUND(v_subtotal,2), v_discount, v_iva,
                      v_total, v_detalle;
END;
$$;

-- ---------- Procedimientos: consultas de ventas y dashboard ----------
DROP FUNCTION IF EXISTS sp_list_sales(TEXT,INT);
CREATE OR REPLACE FUNCTION sp_list_sales(p_role TEXT, p_user_id INT)
RETURNS TABLE (o_id INT, o_buyer VARCHAR, o_subtotal NUMERIC,
               o_discount NUMERIC, o_iva NUMERIC, o_total NUMERIC,
               o_created TIMESTAMPTZ, o_items INT, o_detalle TEXT,
               o_payment VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_role = 'admin' THEN
    RETURN QUERY SELECT s.id, s.buyer_name, s.subtotal, s.discount, s.iva,
                        s.total, s.created_at, COUNT(i.id)::INT,
                        s.detalle, s.payment_method
                 FROM sales s LEFT JOIN sale_items i ON i.sale_id = s.id
                 GROUP BY s.id ORDER BY s.id DESC;
  ELSE
    RETURN QUERY SELECT s.id, s.buyer_name, s.subtotal, s.discount, s.iva,
                        s.total, s.created_at, COUNT(i.id)::INT,
                        s.detalle, s.payment_method
                 FROM sales s LEFT JOIN sale_items i ON i.sale_id = s.id
                 WHERE s.user_id = p_user_id
                 GROUP BY s.id ORDER BY s.id DESC;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sp_sale_items(p_sale_id INT, p_role TEXT, p_user_id INT)
RETURNS TABLE (o_product VARCHAR, o_qty INT, o_unit_price NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner INT;
BEGIN
  SELECT s.user_id INTO v_owner FROM sales s WHERE s.id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENTA_NO_EXISTE:%', p_sale_id;
  END IF;
  IF p_role <> 'admin'
     AND (v_owner IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'SIN_PERMISO_VENTA:%', p_sale_id;
  END IF;
  RETURN QUERY SELECT p.name, i.qty, i.unit_price
               FROM sale_items i JOIN products p ON p.id = i.product_id
               WHERE i.sale_id = p_sale_id ORDER BY i.id;
END;
$$;

-- Encabezado de venta (para el ticket descargable)
DROP FUNCTION IF EXISTS sp_get_sale(INT,TEXT,INT);
CREATE OR REPLACE FUNCTION sp_get_sale(p_sale_id INT, p_role TEXT, p_user_id INT)
RETURNS TABLE (o_id INT, o_buyer VARCHAR, o_subtotal NUMERIC,
               o_discount NUMERIC, o_iva NUMERIC, o_total NUMERIC,
               o_created TIMESTAMPTZ, o_detalle TEXT, o_payment VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner INT;
BEGIN
  SELECT s.user_id INTO v_owner FROM sales s WHERE s.id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VENTA_NO_EXISTE:%', p_sale_id;
  END IF;
  IF p_role <> 'admin'
     AND (v_owner IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'SIN_PERMISO_VENTA:%', p_sale_id;
  END IF;
  RETURN QUERY SELECT s.id, s.buyer_name, s.subtotal, s.discount, s.iva,
                      s.total, s.created_at, s.detalle, s.payment_method
               FROM sales s WHERE s.id = p_sale_id;
END;
$$;

-- ---------- Procedimientos: descuentos del admin ----------
CREATE OR REPLACE FUNCTION sp_set_discount(p_scope TEXT, p_target TEXT,
                                           p_percent NUMERIC)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id INT;
BEGIN
  IF p_scope NOT IN ('seccion','producto') THEN
    RAISE EXCEPTION 'ALCANCE_INVALIDO:%', p_scope;
  END IF;
  IF p_scope = 'seccion'
     AND NOT EXISTS (SELECT 1 FROM departments
                     WHERE name = p_target AND active) THEN
    RAISE EXCEPTION 'DEPARTAMENTO_INVALIDO:%', p_target;
  END IF;
  IF p_percent <= 0 OR p_percent > 90 THEN
    RAISE EXCEPTION 'DESCUENTO_INVALIDO:1-90';
  END IF;
  INSERT INTO discounts(scope, target, percent, active)
  VALUES (p_scope, p_target, p_percent, TRUE)
  ON CONFLICT (scope, target)
  DO UPDATE SET percent = EXCLUDED.percent, active = TRUE
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION sp_list_discounts()
RETURNS TABLE (o_id INT, o_scope VARCHAR, o_target VARCHAR,
               o_percent NUMERIC, o_active BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT d.id, d.scope, d.target, d.percent, d.active
               FROM discounts d ORDER BY d.scope, d.target;
END;
$$;

CREATE OR REPLACE FUNCTION sp_toggle_discount(p_id INT, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE discounts SET active = p_active WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DESCUENTO_NO_EXISTE:%', p_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION sp_delete_discount(p_id INT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM discounts WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DESCUENTO_NO_EXISTE:%', p_id;
  END IF;
END;
$$;

-- % vigente para un producto (el mayor entre producto y seccion)
CREATE OR REPLACE FUNCTION sp_product_discount(p_sku TEXT, p_category TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pct NUMERIC;
BEGIN
  SELECT COALESCE(MAX(d.percent), 0) INTO v_pct FROM discounts d
  WHERE d.active AND ((d.scope = 'producto' AND d.target = p_sku)
                    OR (d.scope = 'seccion' AND d.target = p_category));
  RETURN v_pct;
END;
$$;

-- Alerta automatica: productos con menos de 5 en stock (notificacion al admin)
DROP FUNCTION IF EXISTS sp_low_stock();
CREATE OR REPLACE FUNCTION sp_low_stock()
RETURNS TABLE (o_id INT, o_name VARCHAR, o_sku VARCHAR,
               o_price NUMERIC, o_stock INT, o_category VARCHAR,
               o_image TEXT, o_features TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT p.id, p.name, p.sku, p.price, p.stock, p.category,
                      p.image_url, p.description
               FROM products p WHERE p.stock < 5 ORDER BY p.stock, p.id;
END;
$$;

DROP FUNCTION IF EXISTS sp_dashboard_stats();
CREATE OR REPLACE FUNCTION sp_dashboard_stats()
RETURNS TABLE (o_ventas BIGINT, o_ingresos NUMERIC,
               o_bajo_stock BIGINT, o_usuarios BIGINT, o_alertas BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT (SELECT COUNT(*) FROM sales),
                      COALESCE((SELECT SUM(total) FROM sales),0),
                      (SELECT COUNT(*) FROM products WHERE stock < 5),
                      (SELECT COUNT(*) FROM users),
                      (SELECT COUNT(*) FROM products WHERE stock < 5);
END;
$$;

-- La API solo ejecuta funciones: sin acceso directo a tablas.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO pos;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO pos;

-- ---------- Seed via procedimientos (no INSERTs directos) ----------
DO $$
BEGIN
  INSERT INTO departments(name, prefix) VALUES
    ('Alimentos y Abarrotes','ALI'), ('Bebidas y Botanas','BEB'),
    ('Higiene y Limpieza','HIG'), ('Lacteos y Frescos','LAC')
  ON CONFLICT (name) DO UPDATE SET prefix = EXCLUDED.prefix;
  IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
    -- hash bcrypt de "Admin123*" (generado con lib bcrypt)
    PERFORM sp_create_user('admin','Administrador',
      '$2b$12$EJGGqylhN74VnsWPKQXFT.tcNFbBqBOO0I7jZTRLBWSCM1gCQOWoi',
      'admin','admin@tienda.local');
  END IF;
  -- Alimentos y Abarrotes
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'ACE-500') THEN
    PERFORM sp_create_product('Aceite vegetal 500ml Cristal','ACE-500',45,20,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'ACE-1000') THEN
    PERFORM sp_create_product('Aceite vegetal 1L Nutrioli','ACE-1000',78,15,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'ARR-500') THEN
    PERFORM sp_create_product('Arroz 500g','ARR-500',22,30,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'FRI-1000') THEN
    PERFORM sp_create_product('Frijol 1kg','FRI-1000',48,25,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'AZU-1000') THEN
    PERFORM sp_create_product('Azucar 1kg','AZU-1000',35,30,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SAL-1000') THEN
    PERFORM sp_create_product('Sal molida 1kg','SAL-1000',18,30,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PAS-FID') THEN
    PERFORM sp_create_product('Pasta fideo La Moderna','PAS-FID',12,40,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PAS-COD') THEN
    PERFORM sp_create_product('Pasta codito La Moderna','PAS-COD',12,40,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PAS-ESP') THEN
    PERFORM sp_create_product('Espagueti La Moderna','PAS-ESP',14,40,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'ATU-AGU') THEN
    PERFORM sp_create_product('Atun en agua','ATU-AGU',24,35,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'SAR-001') THEN
    PERFORM sp_create_product('Sardinas','SAR-001',28,25,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CHI-JAL') THEN
    PERFORM sp_create_product('Chiles jalapenos en rajas','CHI-JAL',26,20,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PUR-TOM') THEN
    PERFORM sp_create_product('Pure de tomate','PUR-TOM',20,25,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAF-SOL') THEN
    PERFORM sp_create_product('Cafe soluble frasco chico','CAF-SOL',65,18,'Alimentos y Abarrotes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'TE-SOB') THEN
    PERFORM sp_create_product('Te en sobres 12 pzas','TE-SOB',32,22,'Alimentos y Abarrotes');
  END IF;
  -- Lacteos y Frescos
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LEC-LAL') THEN
    PERFORM sp_create_product('Leche 1L Lala','LEC-LAL',30,25,'Lacteos y Frescos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'LEC-ALP') THEN
    PERFORM sp_create_product('Leche 1L Alpura','LEC-ALP',29,25,'Lacteos y Frescos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'HUE-KG') THEN
    PERFORM sp_create_product('Huevo por kilo','HUE-KG',55,20,'Lacteos y Frescos');
  END IF;
  -- Bebidas y Botanas
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'AGU-600') THEN
    PERFORM sp_create_product('Agua purificada 600ml','AGU-600',12,50,'Bebidas y Botanas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'AGU-1500') THEN
    PERFORM sp_create_product('Agua purificada 1.5L','AGU-1500',22,40,'Bebidas y Botanas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'COC-600') THEN
    PERFORM sp_create_product('Refresco de cola 600ml','COC-600',20,45,'Bebidas y Botanas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'COC-3000') THEN
    PERFORM sp_create_product('Refresco de cola 3L','COC-3000',55,20,'Bebidas y Botanas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PAP-FRI') THEN
    PERFORM sp_create_product('Papas fritas individual','PAP-FRI',18,40,'Bebidas y Botanas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CAC-001') THEN
    PERFORM sp_create_product('Cacahuates botaneros','CAC-001',15,40,'Bebidas y Botanas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'GAL-001') THEN
    PERFORM sp_create_product('Galletas paquete individual','GAL-001',16,40,'Bebidas y Botanas');
  END IF;
  -- Higiene y Limpieza del Hogar
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PH-1') THEN
    PERFORM sp_create_product('Papel higienico 1 rollo','PH-1',12,40,'Higiene y Limpieza');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'PH-4') THEN
    PERFORM sp_create_product('Papel higienico 4 rollos','PH-4',42,25,'Higiene y Limpieza');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'JAB-ZOT') THEN
    PERFORM sp_create_product('Jabon de barra Zote','JAB-ZOT',22,30,'Higiene y Limpieza');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'DET-CH') THEN
    PERFORM sp_create_product('Detergente en polvo chico','DET-CH',28,25,'Higiene y Limpieza');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = 'CLO-001') THEN
    PERFORM sp_create_product('Cloro multiusos','CLO-001',25,30,'Higiene y Limpieza');
  END IF;
END
$$;

-- Las funciones nuevas tambien quedan cubiertas para el rol `pos`.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO pos;
