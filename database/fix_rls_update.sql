-- ============================================================
-- FIX v3: Complete RLS + Schema Fix
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─── 1. FIX PROFILES RLS ─────────────────────────────────

-- Drop all old policies
drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;

-- Helper: check if caller is admin
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Recreate with correct SELECT + INSERT + UPDATE policies
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Grant table-level permissions
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profiles to anon;

-- ─── 2. BACKFILL MISSING PROFILE ROWS ────────────────────
-- Creates profile rows for users who signed up before the trigger was set up

insert into public.profiles (id, name, is_anonymous, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name', 'Visitor'),
  coalesce((u.raw_user_meta_data->>'is_anonymous')::boolean, false),
  'visitor'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- ─── 3. FIX VISITOR_LOCATIONS SCHEMA ─────────────────────
-- Add unique constraint on user_id so authenticated upsert works

alter table public.visitor_locations
  drop constraint if exists visitor_locations_user_id_key;

alter table public.visitor_locations
  add constraint visitor_locations_user_id_key unique (user_id);

-- Fix visitor_locations RLS
drop policy if exists "Anyone can insert their own location" on public.visitor_locations;
drop policy if exists "Users can update their own location" on public.visitor_locations;
drop policy if exists "Admins can read all locations" on public.visitor_locations;

create policy "Anyone can insert location"
  on public.visitor_locations for insert
  with check (true);

create policy "Users can update their own location"
  on public.visitor_locations for update
  using (
    (auth.uid() = user_id)
    or (auth.uid() is null)
    or (user_id is null)
  );

create policy "Admins can read all locations"
  on public.visitor_locations for select
  using (public.is_admin());

grant select, insert, update on public.visitor_locations to authenticated;
grant select, insert, update on public.visitor_locations to anon;
