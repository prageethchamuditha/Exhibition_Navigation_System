-- ============================================================
-- Exhibition Navigation System — App Settings Table
-- Stores global app configuration like 3D model calibration
-- Run this in Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is 'Global system configurations accessible across all client browsers';

-- Enable RLS
alter table public.app_settings enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Anyone can read app settings" on public.app_settings;
drop policy if exists "Admins can insert app settings" on public.app_settings;
drop policy if exists "Admins can update app settings" on public.app_settings;
drop policy if exists "Admins can upsert app settings" on public.app_settings;
drop policy if exists "Allow all app settings" on public.app_settings;

-- Public read & write policies for app settings
create policy "Anyone can read app settings"
  on public.app_settings for select
  using (true);

create policy "Allow all app settings"
  on public.app_settings for all
  using (true)
  with check (true);
