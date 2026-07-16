-- ============================================================
-- Exhibition Navigation System — Store Module Extension
-- Module 3: Contact Details, Gallery Images & Promotions
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────
-- 1. ADD CONTACT FIELDS TO STORES
-- ─────────────────────────────────────────
alter table public.stores 
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text;

-- ─────────────────────────────────────────
-- 2. STORE IMAGES GALLERY
-- ─────────────────────────────────────────
create table if not exists public.store_images (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  image_url  text not null,
  created_at timestamptz not null default now()
);

comment on table public.store_images is 'Image gallery for exhibitors/stores';

-- ─────────────────────────────────────────
-- 3. PROMOTIONS / OFFERS
-- ─────────────────────────────────────────
create table if not exists public.promotions (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores(id) on delete cascade,
  title         text not null,
  description   text,
  discount_code text,            -- e.g. "SAVE20", "EXPO5"
  banner_url    text,
  start_date    date,
  end_date      date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.promotions is 'Promotions and special offers run by exhibitors';

-- ─────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.store_images enable row level security;
alter table public.promotions   enable row level security;

-- ── STORE IMAGES ──
drop policy if exists "Anyone can view store images" on public.store_images;
create policy "Anyone can view store images"
  on public.store_images for select using (true);

drop policy if exists "Admins can manage store images" on public.store_images;
create policy "Admins can manage store images"
  on public.store_images for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── PROMOTIONS ──
drop policy if exists "Anyone can view active promotions" on public.promotions;
create policy "Anyone can view active promotions"
  on public.promotions for select using (is_active = true);

drop policy if exists "Admins can view all promotions" on public.promotions;
create policy "Admins can view all promotions"
  on public.promotions for select using (public.is_admin());

drop policy if exists "Admins can manage promotions" on public.promotions;
create policy "Admins can manage promotions"
  on public.promotions for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────
-- 5. AUTO updated_at FOR PROMOTIONS
-- ─────────────────────────────────────────
create or replace trigger promotions_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────
-- 6. STORAGE BUCKET FOR STORE ASSETS
-- ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

-- Enable public read on bucket objects
drop policy if exists "Anyone can view store assets" on storage.objects;
create policy "Anyone can view store assets"
  on storage.objects for select
  using (bucket_id = 'store-assets');

-- Enable admin CRUD operations on bucket objects
drop policy if exists "Admins can upload store assets" on storage.objects;
create policy "Admins can upload store assets"
  on storage.objects for insert
  with check (bucket_id = 'store-assets' and public.is_admin());

drop policy if exists "Admins can delete store assets" on storage.objects;
create policy "Admins can delete store assets"
  on storage.objects for delete
  using (bucket_id = 'store-assets' and public.is_admin());

