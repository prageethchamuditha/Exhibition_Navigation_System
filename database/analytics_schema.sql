-- ============================================================
-- Exhibition Navigation System — Analytics Module Schema
-- Module 8: Analytics (Visitor logs, Popular stores & Routes)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────
-- 1. ANALYTICS EVENTS LOGS
-- ─────────────────────────────────────────
create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null,                   -- 'store_view' | 'route_calculation' | 'search_query'
  target_id   uuid,                            -- store_id or navigation_node_id
  target_name text not null,                   -- human readable target name (e.g. store name)
  metadata    jsonb default '{}'::jsonb,      -- additional details (e.g. search keyword, user agent)
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.analytics_events is 'Logs visitor engagement events (booth views, navigations) for admin statistics';

-- ─────────────────────────────────────────
-- 2. ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.analytics_events enable row level security;

-- Visitors can log their own actions (Anonymous sessions allowed too)
drop policy if exists "Anyone can insert analytics events" on public.analytics_events;
create policy "Anyone can insert analytics events"
  on public.analytics_events for insert
  with check (true);

-- Only Admins can select / analyze records
drop policy if exists "Admins can view analytics events" on public.analytics_events;
create policy "Admins can view analytics events"
  on public.analytics_events for select
  using (public.is_admin());
