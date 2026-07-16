-- ============================================================
-- Exhibition Navigation System — Exhibition Module Extension
-- Module 4: Coordinates & Exhibition Schedules
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────
-- 1. ADD COORDS TO EXHIBITIONS
-- ─────────────────────────────────────────
alter table public.exhibitions 
  add column if not exists latitude float8,
  add column if not exists longitude float8;

-- ─────────────────────────────────────────
-- 2. EXHIBITION EVENTS SCHEDULE
-- ─────────────────────────────────────────
create table if not exists public.exhibition_events (
  id            uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  title         text not null,
  description   text,
  location      text,            -- e.g. "Main Hall", "Stage B"
  speaker       text,            -- Guest speaker / presenter
  start_time    timestamptz not null,
  end_time      timestamptz not null,
  created_at    timestamptz not null default now()
);

comment on table public.exhibition_events is 'Program schedules and seminars within exhibitions';

-- ─────────────────────────────────────────
-- 3. ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.exhibition_events enable row level security;

-- ── EXHIBITION EVENTS ──
drop policy if exists "Anyone can view exhibition events" on public.exhibition_events;
create policy "Anyone can view exhibition events"
  on public.exhibition_events for select using (true);

drop policy if exists "Admins can manage exhibition events" on public.exhibition_events;
create policy "Admins can manage exhibition events"
  on public.exhibition_events for all
  using (public.is_admin())
  with check (public.is_admin());
