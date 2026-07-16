-- ============================================================
-- Exhibition Navigation System — Supabase Realtime Publications
-- Module 7: Live Announcements & Realtime Notifications
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable full replication identity on announcements to track updates
alter table public.announcements replica identity full;

-- Add announcements table to the supabase_realtime publication safely
do $$
begin
  alter publication supabase_realtime add table public.announcements;
exception
  when others then
    null; -- Ignore if already added or publication matches
end $$;

-- Enable full replication identity on visitor_locations to track updates
alter table public.visitor_locations replica identity full;

-- Add visitor_locations table to the supabase_realtime publication safely
do $$
begin
  alter publication supabase_realtime add table public.visitor_locations;
exception
  when others then
    null; -- Ignore if already added or publication matches
end $$;

