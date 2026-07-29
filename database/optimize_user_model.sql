-- ============================================================
-- Exhibition Navigation System — Optimize User/Profile Model
-- Run this in your Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- 1. OPTIMIZE EXPIRED ANONYMOUS CLEANUP QUERY
-- Optimizes: SELECT id FROM public.profiles WHERE is_anonymous = true AND created_at < ...
CREATE INDEX IF NOT EXISTS idx_profiles_anonymous_cleanup 
ON public.profiles (is_anonymous, created_at);

-- 2. OPTIMIZE ADMIN VISITORS DASHBOARD SORTING
-- Optimizes: SELECT * FROM public.profiles ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc 
ON public.profiles (created_at DESC);

-- 3. OPTIMIZE FOREIGN KEYS FOR CASCADING DELETES (PREVENTS FULL TABLE SCANS)
-- When a user is deleted from auth.users, Postgres cascades to these tables.
-- Indexing these foreign keys prevents sequential scans on delete.

-- Optimizes: visitor_locations cascading delete / updates
CREATE INDEX IF NOT EXISTS idx_visitor_locations_user_id 
ON public.visitor_locations (user_id);

-- Optimizes: analytics_events set null on delete
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id 
ON public.analytics_events (user_id) 
WHERE user_id IS NOT NULL;

-- Optimizes: exhibitions set null on delete
CREATE INDEX IF NOT EXISTS idx_exhibitions_created_by 
ON public.exhibitions (created_by) 
WHERE created_by IS NOT NULL;

-- Optimizes: stores set null on delete
CREATE INDEX IF NOT EXISTS idx_stores_created_by 
ON public.stores (created_by) 
WHERE created_by IS NOT NULL;

-- Optimizes: announcements set null on delete
CREATE INDEX IF NOT EXISTS idx_announcements_created_by 
ON public.announcements (created_by) 
WHERE created_by IS NOT NULL;

-- 4. OPTIMIZE STALE ANONYMOUS LOCATION CLEANUP
-- Optimizes: DELETE FROM public.visitor_locations WHERE user_id IS NULL AND updated_at < ...
CREATE INDEX IF NOT EXISTS idx_visitor_locations_stale_cleanup 
ON public.visitor_locations (updated_at) 
WHERE user_id IS NULL;
