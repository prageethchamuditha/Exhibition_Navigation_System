-- ============================================================
-- Add store_admin_id column to stores table
-- This separates "creator" (created_by) from "assigned store admin" (store_admin_id)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add the new column
alter table public.stores
  add column if not exists store_admin_id uuid references auth.users(id) on delete set null;

comment on column public.stores.store_admin_id is
  'UUID of the store_admin user assigned to manage this store';

-- 2. Update RLS policies to use store_admin_id for store_admin access
-- Drop old policies that used created_by for store_admin filtering
drop policy if exists "Store admins can view own stores"       on public.stores;
drop policy if exists "Store admins can update own stores"     on public.stores;
drop policy if exists "Store admins can view own store images" on public.store_images;
drop policy if exists "Store admins can manage own store images" on public.store_images;
drop policy if exists "Store admins can view own promotions"   on public.promotions;
drop policy if exists "Store admins can manage own promotions" on public.promotions;

-- 3. Recreate store policies using store_admin_id
create policy "Store admins can view own stores"
  on public.stores for select
  using (
    auth.uid() = store_admin_id
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin')
    )
    or true  -- visitors can also read stores
  );

create policy "Store admins can update own stores"
  on public.stores for update
  using (auth.uid() = store_admin_id)
  with check (auth.uid() = store_admin_id);

-- 4. Recreate store_images policies using store_admin_id
create policy "Store admins can view own store images"
  on public.store_images for select
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_id and s.store_admin_id = auth.uid()
    )
  );

create policy "Store admins can manage own store images"
  on public.store_images for all
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_id and s.store_admin_id = auth.uid()
    )
  );

-- 5. Recreate promotions policies using store_admin_id
create policy "Store admins can view own promotions"
  on public.promotions for select
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_id and s.store_admin_id = auth.uid()
    )
  );

create policy "Store admins can manage own promotions"
  on public.promotions for all
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_id and s.store_admin_id = auth.uid()
    )
  );
