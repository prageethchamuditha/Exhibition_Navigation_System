-- ============================================================
-- Exhibition Navigation System — Admin Module Schema
-- Module 2: Exhibitions, Stores, Categories, Announcements,
--            Navigation Nodes & Edges
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- ─────────────────────────────────────────
-- 1. CATEGORIES
-- ─────────────────────────────────────────
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  icon       text,            -- lucide icon name e.g. "ShoppingBag"
  color      text,            -- hex color e.g. "#6366f1"
  created_at timestamptz not null default now()
);

comment on table public.categories is 'Store/exhibition categories';

-- ─────────────────────────────────────────
-- 2. EXHIBITIONS
-- ─────────────────────────────────────────
create table if not exists public.exhibitions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  image_url   text,
  location    text,
  start_date  date,
  end_date    date,
  is_featured boolean not null default false,
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.exhibitions is 'Exhibition events managed by admins';

-- ─────────────────────────────────────────
-- 3. STORES
-- ─────────────────────────────────────────
create table if not exists public.stores (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  logo_url      text,
  category_id   uuid references public.categories(id) on delete set null,
  exhibition_id uuid references public.exhibitions(id) on delete set null,
  floor         text,
  opening_time  time,
  closing_time  time,
  latitude      float8,
  longitude     float8,
  is_active     boolean not null default true,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.stores is 'Stores / booths within exhibitions';

-- ─────────────────────────────────────────
-- 4. ANNOUNCEMENTS
-- ─────────────────────────────────────────
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  message    text not null,
  type       text not null default 'info',   -- 'info' | 'warning' | 'emergency'
  is_active  boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.announcements is 'Broadcast announcements to visitors';

-- ─────────────────────────────────────────
-- 5. NAVIGATION NODES
-- ─────────────────────────────────────────
create table if not exists public.navigation_nodes (
  id        uuid primary key default gen_random_uuid(),
  label     text not null,
  latitude  float8 not null,
  longitude float8 not null,
  floor     text,
  type      text not null default 'path',   -- 'path' | 'entrance' | 'poi' | 'store' | 'emergency'
  store_id  uuid references public.stores(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.navigation_nodes is 'Graph nodes for indoor navigation pathfinding';

-- ─────────────────────────────────────────
-- 6. NAVIGATION EDGES
-- ─────────────────────────────────────────
create table if not exists public.navigation_edges (
  id               uuid primary key default gen_random_uuid(),
  from_node_id     uuid not null references public.navigation_nodes(id) on delete cascade,
  to_node_id       uuid not null references public.navigation_nodes(id) on delete cascade,
  distance         float8 not null default 1,    -- weight in metres
  is_bidirectional boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (from_node_id, to_node_id)
);

comment on table public.navigation_edges is 'Graph edges connecting navigation nodes';

-- ─────────────────────────────────────────
-- 7. ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.categories         enable row level security;
alter table public.exhibitions        enable row level security;
alter table public.stores             enable row level security;
alter table public.announcements      enable row level security;
alter table public.navigation_nodes   enable row level security;
alter table public.navigation_edges   enable row level security;

-- Helper: check if caller is admin
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── CATEGORIES ──
create policy "Anyone can read categories"
  on public.categories for select using (true);

create policy "Admins can manage categories"
  on public.categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── EXHIBITIONS ──
create policy "Anyone can read active exhibitions"
  on public.exhibitions for select using (is_active = true);

create policy "Admins can read all exhibitions"
  on public.exhibitions for select using (public.is_admin());

create policy "Admins can manage exhibitions"
  on public.exhibitions for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── STORES ──
create policy "Anyone can read active stores"
  on public.stores for select using (is_active = true);

create policy "Admins can read all stores"
  on public.stores for select using (public.is_admin());

create policy "Admins can manage stores"
  on public.stores for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── ANNOUNCEMENTS ──
create policy "Anyone can read active announcements"
  on public.announcements for select using (is_active = true);

create policy "Admins can read all announcements"
  on public.announcements for select using (public.is_admin());

create policy "Admins can manage announcements"
  on public.announcements for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── NAVIGATION NODES ──
create policy "Anyone can read navigation nodes"
  on public.navigation_nodes for select using (true);

create policy "Admins can manage navigation nodes"
  on public.navigation_nodes for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── NAVIGATION EDGES ──
create policy "Anyone can read navigation edges"
  on public.navigation_edges for select using (true);

create policy "Admins can manage navigation edges"
  on public.navigation_edges for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────
-- 8. AUTO updated_at TRIGGERS
-- ─────────────────────────────────────────
create or replace trigger exhibitions_updated_at
  before update on public.exhibitions
  for each row execute function public.set_updated_at();

create or replace trigger stores_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

create or replace trigger announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────
-- 9. PROMOTE USER TO ADMIN (template)
--    Replace <your-user-uuid> then run
-- ─────────────────────────────────────────
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
