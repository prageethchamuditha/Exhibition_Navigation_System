-- ============================================================
-- Exhibition Navigation System — Full Database Schema
-- Single merged file. Run this once in Supabase SQL Editor.
-- 
-- Execution order:
--   §1  Core tables & triggers     (schema.sql + fixes)
--   §2  Admin module tables        (admin_schema.sql)
--   §3  Store extensions           (store_module_schema.sql)
--   §4  Exhibition extensions      (exhibition_module_schema.sql)
--   §5  Analytics                  (analytics_schema.sql)
--   §6  Row-level security (all)   (fix_rls_update.sql + patches)
--   §7  Admin RPC functions        (allow_admin_*)
--   §8  Store admin policies       (allow_store_admins + add_store_admin_id)
--   §9  Realtime publications      (realtime_subscription.sql)
--   §10 Performance indexes        (optimize_user_model.sql — updated)
--   §11 Visitor session helpers    (cleanup fn + disable note)
-- ============================================================


-- ═══════════════════════════════════════════════════════════════
-- §1  CORE TABLES & HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1.1  PROFILES TABLE
--      Extends auth.users with app data
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text,
  email        text,                                 -- mirrors auth.users.email
  phone        text,
  role         text        NOT NULL DEFAULT 'visitor',  -- 'visitor' | 'admin' | 'store_admin'
  avatar_url   text,
  is_anonymous boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Extended user profile linked to Supabase Auth';

-- ─────────────────────────────────────────
-- 1.2  VISITOR LOCATIONS TABLE
--      Live GPS positions (auth + anonymous)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visitor_locations (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid      REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  text,                   -- fallback key for anonymous visitors
  latitude    float8    NOT NULL,
  longitude   float8    NOT NULL,
  accuracy    float8,                 -- GPS accuracy in metres
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.visitor_locations IS
  'Real-time visitor GPS locations. user_id for authenticated users, session_id for anonymous.';

-- Unique constraint required for authenticated upsert
ALTER TABLE public.visitor_locations
  DROP CONSTRAINT IF EXISTS visitor_locations_user_id_key;

ALTER TABLE public.visitor_locations
  ADD CONSTRAINT visitor_locations_user_id_key UNIQUE (user_id);

-- ─────────────────────────────────────────
-- 1.3  HELPER: is_admin()
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─────────────────────────────────────────
-- 1.4  HELPER: is_store_admin()
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_store_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'store_admin'
  );
$$;

-- ─────────────────────────────────────────
-- 1.5  TRIGGER: auto-create profile on signup
--      Uses auth.users.is_anonymous natively
--      and also captures email
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, is_anonymous)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Visitor'),
    new.email,
    COALESCE(new.is_anonymous, false)   -- reads the native auth.users column
  );
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────
-- 1.6  TRIGGER: auto-update updated_at
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill email for existing users who signed up before the email column existed
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- Backfill is_anonymous for any rows incorrectly marked as registered
UPDATE public.profiles
SET is_anonymous = true
WHERE id IN (
  SELECT id FROM auth.users WHERE is_anonymous = true
);

-- Backfill profile rows for users that existed before the trigger was created
INSERT INTO public.profiles (id, name, email, is_anonymous, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', 'Visitor'),
  u.email,
  COALESCE((u.raw_user_meta_data->>'is_anonymous')::boolean, false),
  'visitor'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);


-- ═══════════════════════════════════════════════════════════════
-- §2  ADMIN MODULE TABLES
--     Categories, Exhibitions, Stores, Announcements,
--     Navigation Nodes & Edges
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 2.1  CATEGORIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  icon       text,       -- lucide icon name e.g. "ShoppingBag"
  color      text,       -- hex color e.g. "#6366f1"
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.categories IS 'Store/exhibition categories';

-- ─────────────────────────────────────────
-- 2.2  EXHIBITIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exhibitions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  description text,
  image_url   text,
  location    text,
  start_date  date,
  end_date    date,
  latitude    float8,
  longitude   float8,
  is_featured boolean     NOT NULL DEFAULT false,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exhibitions IS 'Exhibition events managed by admins';

CREATE OR REPLACE TRIGGER exhibitions_updated_at
  BEFORE UPDATE ON public.exhibitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────
-- 2.3  STORES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stores (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  description    text,
  logo_url       text,
  category_id    uuid        REFERENCES public.categories(id) ON DELETE SET NULL,
  exhibition_id  uuid        REFERENCES public.exhibitions(id) ON DELETE SET NULL,
  floor          text,
  opening_time   time,
  closing_time   time,
  latitude       float8,
  longitude      float8,
  phone          text,
  email          text,
  website        text,
  is_active      boolean     NOT NULL DEFAULT true,
  created_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  store_admin_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stores IS 'Stores / booths within exhibitions';
COMMENT ON COLUMN public.stores.store_admin_id IS
  'UUID of the store_admin user assigned to manage this store (separate from creator)';

CREATE OR REPLACE TRIGGER stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────
-- 2.4  ANNOUNCEMENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text        NOT NULL,
  message    text        NOT NULL,
  type       text        NOT NULL DEFAULT 'info',  -- 'info' | 'warning' | 'emergency'
  is_active  boolean     NOT NULL DEFAULT true,
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.announcements IS 'Broadcast announcements to visitors';

CREATE OR REPLACE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────
-- 2.5  NAVIGATION NODES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.navigation_nodes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text        NOT NULL,
  latitude   float8      NOT NULL,
  longitude  float8      NOT NULL,
  floor      text,
  type       text        NOT NULL DEFAULT 'path',  -- 'path'|'entrance'|'poi'|'store'|'emergency'
  store_id   uuid        REFERENCES public.stores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.navigation_nodes IS 'Graph nodes for indoor navigation pathfinding';

-- ─────────────────────────────────────────
-- 2.6  NAVIGATION EDGES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.navigation_edges (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id     uuid    NOT NULL REFERENCES public.navigation_nodes(id) ON DELETE CASCADE,
  to_node_id       uuid    NOT NULL REFERENCES public.navigation_nodes(id) ON DELETE CASCADE,
  distance         float8  NOT NULL DEFAULT 1,   -- weight in metres
  is_bidirectional boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_node_id, to_node_id)
);

COMMENT ON TABLE public.navigation_edges IS 'Graph edges connecting navigation nodes';


-- ═══════════════════════════════════════════════════════════════
-- §3  STORE MODULE EXTENSIONS
--     Store Images & Promotions
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 3.1  STORE IMAGES GALLERY
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.store_images (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  image_url  text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.store_images IS 'Image gallery for exhibitors/stores';

-- ─────────────────────────────────────────
-- 3.2  PROMOTIONS / OFFERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promotions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  discount_code text,
  banner_url    text,
  start_date    date,
  end_date      date,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.promotions IS 'Promotions and special offers run by exhibitors';

CREATE OR REPLACE TRIGGER promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────
-- 3.3  STORAGE BUCKET FOR STORE ASSETS
-- ─────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view store assets"    ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload store assets"  ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete store assets"  ON storage.objects;

CREATE POLICY "Anyone can view store assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets');

CREATE POLICY "Admins can upload store assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'store-assets' AND public.is_admin());

CREATE POLICY "Admins can delete store assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'store-assets' AND public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- §4  EXHIBITION MODULE EXTENSIONS
--     Exhibition Events / Schedules
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.exhibition_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibition_id uuid        NOT NULL REFERENCES public.exhibitions(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  location      text,       -- e.g. "Main Hall", "Stage B"
  speaker       text,       -- guest speaker / presenter
  start_time    timestamptz NOT NULL,
  end_time      timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exhibition_events IS 'Program schedules and seminars within exhibitions';


-- ═══════════════════════════════════════════════════════════════
-- §5  ANALYTICS MODULE
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL,  -- 'store_view' | 'route_calculation' | 'search_query'
  target_id   uuid,                  -- store_id or navigation_node_id
  target_name text        NOT NULL,  -- human-readable target name
  metadata    jsonb       DEFAULT '{}'::jsonb,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.analytics_events IS
  'Logs visitor engagement events (booth views, navigations) for admin statistics';


-- ═══════════════════════════════════════════════════════════════
-- §6  ROW LEVEL SECURITY (all tables)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibitions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_nodes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_edges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_images      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events  ENABLE ROW LEVEL SECURITY;

-- ── PROFILES ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read their own profile"    ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles"        ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles"          ON public.profiles;

CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.profiles TO anon;

-- ── VISITOR LOCATIONS ──────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can insert their own location" ON public.visitor_locations;
DROP POLICY IF EXISTS "Anyone can insert location"           ON public.visitor_locations;
DROP POLICY IF EXISTS "Users can update their own location"  ON public.visitor_locations;
DROP POLICY IF EXISTS "Admins can read all locations"        ON public.visitor_locations;
DROP POLICY IF EXISTS "Admins can delete visitor locations"  ON public.visitor_locations;

CREATE POLICY "Anyone can insert location"
  ON public.visitor_locations FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own location"
  ON public.visitor_locations FOR UPDATE
  USING (
    (auth.uid() = user_id)
    OR (auth.uid() IS NULL)
    OR (user_id IS NULL)
  );

CREATE POLICY "Admins can read all locations"
  ON public.visitor_locations FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can delete visitor locations"
  ON public.visitor_locations FOR DELETE USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitor_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.visitor_locations TO anon;

-- ── CATEGORIES ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read categories"    ON public.categories;
DROP POLICY IF EXISTS "Admins can manage categories"  ON public.categories;

CREATE POLICY "Anyone can read categories"
  ON public.categories FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── EXHIBITIONS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read active exhibitions" ON public.exhibitions;
DROP POLICY IF EXISTS "Admins can read all exhibitions"    ON public.exhibitions;
DROP POLICY IF EXISTS "Admins can manage exhibitions"      ON public.exhibitions;

CREATE POLICY "Anyone can read active exhibitions"
  ON public.exhibitions FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can read all exhibitions"
  ON public.exhibitions FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage exhibitions"
  ON public.exhibitions FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── STORES ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read active stores"        ON public.stores;
DROP POLICY IF EXISTS "Admins can read all stores"           ON public.stores;
DROP POLICY IF EXISTS "Admins can manage stores"             ON public.stores;
DROP POLICY IF EXISTS "Store admins can read owned stores"   ON public.stores;
DROP POLICY IF EXISTS "Store admins can update owned stores" ON public.stores;
DROP POLICY IF EXISTS "Store admins can view own stores"     ON public.stores;
DROP POLICY IF EXISTS "Store admins can update own stores"   ON public.stores;

CREATE POLICY "Anyone can read active stores"
  ON public.stores FOR SELECT USING (is_active = true OR auth.uid() = store_admin_id OR public.is_admin());

CREATE POLICY "Admins can manage stores"
  ON public.stores FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Store admins can update own stores"
  ON public.stores FOR UPDATE
  USING (auth.uid() = store_admin_id)
  WITH CHECK (auth.uid() = store_admin_id);

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read active announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can read all announcements"    ON public.announcements;
DROP POLICY IF EXISTS "Admins can manage announcements"      ON public.announcements;

CREATE POLICY "Anyone can read active announcements"
  ON public.announcements FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can read all announcements"
  ON public.announcements FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can manage announcements"
  ON public.announcements FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── NAVIGATION NODES ──────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read navigation nodes"  ON public.navigation_nodes;
DROP POLICY IF EXISTS "Admins can manage navigation nodes" ON public.navigation_nodes;

CREATE POLICY "Anyone can read navigation nodes"
  ON public.navigation_nodes FOR SELECT USING (true);

CREATE POLICY "Admins can manage navigation nodes"
  ON public.navigation_nodes FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── NAVIGATION EDGES ──────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read navigation edges"  ON public.navigation_edges;
DROP POLICY IF EXISTS "Admins can manage navigation edges" ON public.navigation_edges;

CREATE POLICY "Anyone can read navigation edges"
  ON public.navigation_edges FOR SELECT USING (true);

CREATE POLICY "Admins can manage navigation edges"
  ON public.navigation_edges FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── STORE IMAGES ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view store images"                ON public.store_images;
DROP POLICY IF EXISTS "Admins can manage store images"              ON public.store_images;
DROP POLICY IF EXISTS "Store admins can manage owned store images"  ON public.store_images;
DROP POLICY IF EXISTS "Store admins can view own store images"      ON public.store_images;
DROP POLICY IF EXISTS "Store admins can manage own store images"    ON public.store_images;

CREATE POLICY "Anyone can view store images"
  ON public.store_images FOR SELECT USING (true);

CREATE POLICY "Admins can manage store images"
  ON public.store_images FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Store admins can manage own store images"
  ON public.store_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.store_admin_id = auth.uid()
    )
  );

-- ── PROMOTIONS ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view active promotions"        ON public.promotions;
DROP POLICY IF EXISTS "Admins can view all promotions"           ON public.promotions;
DROP POLICY IF EXISTS "Admins can manage promotions"             ON public.promotions;
DROP POLICY IF EXISTS "Store admins can manage owned promotions" ON public.promotions;
DROP POLICY IF EXISTS "Store admins can view own promotions"     ON public.promotions;
DROP POLICY IF EXISTS "Store admins can manage own promotions"   ON public.promotions;

CREATE POLICY "Anyone can view active promotions"
  ON public.promotions FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage promotions"
  ON public.promotions FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Store admins can manage own promotions"
  ON public.promotions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = store_id AND s.store_admin_id = auth.uid()
    )
  );

-- ── EXHIBITION EVENTS ─────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view exhibition events"  ON public.exhibition_events;
DROP POLICY IF EXISTS "Admins can manage exhibition events" ON public.exhibition_events;

CREATE POLICY "Anyone can view exhibition events"
  ON public.exhibition_events FOR SELECT USING (true);

CREATE POLICY "Admins can manage exhibition events"
  ON public.exhibition_events FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── ANALYTICS EVENTS ──────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
DROP POLICY IF EXISTS "Admins can view analytics events"   ON public.analytics_events;

CREATE POLICY "Anyone can insert analytics events"
  ON public.analytics_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view analytics events"
  ON public.analytics_events FOR SELECT USING (public.is_admin());


-- ═══════════════════════════════════════════════════════════════
-- §7  ADMIN RPC FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- 7.1  delete_user — hard-delete via RPC
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_user(user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete users.';
  END IF;
  IF auth.uid() = user_id THEN
    RAISE EXCEPTION 'Conflict: You cannot delete your own account.';
  END IF;
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- ─────────────────────────────────────────
-- 7.2  create_new_user — admin creates user
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_new_user(
  username_or_email text,
  password_text     text,
  display_name_text text,
  phone_text        text,
  role_text         text
)
RETURNS uuid LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  new_user_id    uuid;
  formatted_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create new users.';
  END IF;

  formatted_email := trim(username_or_email);
  IF position('@' IN formatted_email) = 0 THEN
    formatted_email := formatted_email || '@exnav.local';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = formatted_email) THEN
    RAISE EXCEPTION 'Conflict: The username or email is already taken.';
  END IF;

  IF length(password_text) < 6 THEN
    RAISE EXCEPTION 'Invalid: Password must be at least 6 characters.';
  END IF;

  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at, recovery_sent_at,
    last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new,
    recovery_token, is_super_admin
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated', formatted_email,
    crypt(password_text, gen_salt('bf')), now(), NULL, NULL,
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('name', display_name_text, 'is_anonymous', false),
    now(), now(), '', '', '', '', false
  );

  UPDATE public.profiles
  SET role  = role_text,
      phone = NULLIF(trim(phone_text), '')
  WHERE id = new_user_id;

  RETURN new_user_id;
END;
$$;

-- ─────────────────────────────────────────
-- 7.3  update_user_email — admin changes email
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_user_email(user_id uuid, new_email text)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update user emails.';
  END IF;
  IF position('@' IN new_email) = 0 THEN
    RAISE EXCEPTION 'Invalid: Email format is incorrect.';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = new_email AND id != user_id) THEN
    RAISE EXCEPTION 'Conflict: The username or email is already taken.';
  END IF;

  UPDATE auth.users
  SET email = new_email, email_confirmed_at = now(), updated_at = now()
  WHERE id = user_id;

  UPDATE public.profiles
  SET email = new_email, updated_at = now()
  WHERE id = user_id;
END;
$$;

-- ─────────────────────────────────────────
-- 7.4  update_user_password — admin changes password
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_user_password(user_id uuid, new_password text)
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth, extensions AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update user passwords.';
  END IF;
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'Invalid: Password must be at least 6 characters.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')), updated_at = now()
  WHERE id = user_id;
END;
$$;

-- Grant RPC execution rights
GRANT EXECUTE ON FUNCTION public.delete_user(uuid)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_new_user(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_email(uuid, text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_password(uuid, text)            TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- §8  REALTIME PUBLICATIONS
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.announcements     REPLICA IDENTITY FULL;
ALTER TABLE public.visitor_locations REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_locations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- §9  PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════════════

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc
  ON public.profiles (created_at DESC);

-- Visitor locations — foreign key & stale-row cleanup
CREATE INDEX IF NOT EXISTS idx_visitor_locations_user_id
  ON public.visitor_locations (user_id);

CREATE INDEX IF NOT EXISTS idx_visitor_locations_stale_cleanup
  ON public.visitor_locations (updated_at)
  WHERE user_id IS NULL;

-- Analytics
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id
  ON public.analytics_events (user_id)
  WHERE user_id IS NOT NULL;

-- Exhibition / store creators (cascade delete optimisation)
CREATE INDEX IF NOT EXISTS idx_exhibitions_created_by
  ON public.exhibitions (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stores_created_by
  ON public.stores (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_created_by
  ON public.announcements (created_by)
  WHERE created_by IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════
-- §10  VISITOR SESSION HELPER FUNCTION
--      Kept for manual admin use only.
--      Visitor accounts are now PERMANENT — they are cached in
--      the browser (localStorage key: exnav_visitor_session)
--      and the same identity is restored on every return visit.
--      This function is NOT scheduled automatically.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.delete_expired_anonymous_profiles()
RETURNS void
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
BEGIN
  -- Deletes anonymous users older than 1 hour from auth.users
  -- (cascades to public.profiles and public.visitor_locations)
  DELETE FROM auth.users
  WHERE id IN (
    SELECT id FROM public.profiles
    WHERE is_anonymous = true
    AND created_at < (now() - INTERVAL '1 hour')
  );

  -- Also cleans up orphaned anonymous location rows
  DELETE FROM public.visitor_locations
  WHERE user_id IS NULL
  AND updated_at < (now() - INTERVAL '1 hour');
END;
$$;

COMMENT ON FUNCTION public.delete_expired_anonymous_profiles() IS
  'MANUAL USE ONLY — not scheduled automatically. '
  'Visitor sessions are now persisted via browser localStorage. '
  'Only run this if you need to hard-reset all stale guest accounts.';

GRANT EXECUTE ON FUNCTION public.delete_expired_anonymous_profiles() TO authenticated;

-- Disable any pg_cron job that was scheduling this function
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('delete-expired-anonymous-profiles')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'delete-expired-anonymous-profiles'
      );
    PERFORM cron.unschedule('cleanup-anonymous-users')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'cleanup-anonymous-users'
      );
  END IF;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
-- §11  PROMOTE USER TO ADMIN (run manually, replace UUID)
-- ═══════════════════════════════════════════════════════════════
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-uuid>';


-- ============================================================
-- END OF SCHEMA
-- ============================================================
