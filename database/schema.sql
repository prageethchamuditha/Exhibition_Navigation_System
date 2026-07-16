-- ============================================================
-- Exhibition Navigation System — Database Schema
-- Run this in Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- ─────────────────────────────────────────
-- 1. PROFILES TABLE
--    Extends Supabase auth.users with app data
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  name        text,
  phone       text,
  role        text not null default 'visitor',   -- 'visitor' | 'admin'
  avatar_url  text,
  is_anonymous boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Extended user profile linked to Supabase Auth';

-- ─────────────────────────────────────────
-- 2. VISITOR LOCATIONS TABLE
--    Live GPS positions (including anonymous visitors)
-- ─────────────────────────────────────────
create table if not exists public.visitor_locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  session_id  text,             -- For anonymous visitors (random UUID stored in localStorage)
  latitude    float8 not null,
  longitude   float8 not null,
  accuracy    float8,           -- GPS accuracy in meters
  updated_at  timestamptz not null default now()
);

comment on table public.visitor_locations is 'Real-time visitor GPS locations. user_id for authenticated users, session_id for anonymous.';

-- ─────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.visitor_locations enable row level security;

-- Helper: check if caller is admin
create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Profiles policies
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Visitor locations policies
create policy "Anyone can insert their own location"
  on public.visitor_locations for insert
  with check (true);

create policy "Users can update their own location"
  on public.visitor_locations for update
  using (auth.uid() = user_id or user_id is null);

create policy "Admins can read all locations"
  on public.visitor_locations for select
  using (public.is_admin());

-- ─────────────────────────────────────────
-- 4. AUTO-CREATE PROFILE ON SIGN UP
--    Trigger runs after a new auth.users row is created
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, is_anonymous)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Visitor'),
    coalesce((new.raw_user_meta_data->>'is_anonymous')::boolean, false)
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────
-- 5. AUTO-UPDATE updated_at ON PROFILES
-- ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
