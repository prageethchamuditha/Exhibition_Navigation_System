-- ============================================================
-- Exhibition Navigation System — Disable Anonymous Auto-Cleanup
-- Run this in your Supabase SQL Editor (Settings > SQL Editor)
--
-- PURPOSE: Visitor (anonymous) accounts are now persisted
--   indefinitely in the browser cache and must NOT be deleted
--   automatically. This script disables the scheduled cleanup
--   job that previously removed anonymous users after 1 hour.
-- ============================================================

-- ── 1. Remove the pg_cron scheduled job (if it was set up) ────────────────────
-- This removes any cron jobs that called delete_expired_anonymous_profiles().
-- Safe to run even if no cron job exists — the DO block handles the missing case.
DO $$
BEGIN
  -- Only attempt to unschedule if pg_cron extension is installed
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Unschedule by job name (common names that may have been used)
    PERFORM cron.unschedule('delete-expired-anonymous-profiles')
      WHERE EXISTS (
        SELECT 1 FROM cron.job
        WHERE jobname = 'delete-expired-anonymous-profiles'
      );

    PERFORM cron.unschedule('cleanup-anonymous-users')
      WHERE EXISTS (
        SELECT 1 FROM cron.job
        WHERE jobname = 'cleanup-anonymous-users'
      );
  END IF;
END;
$$;

-- ── 2. Verify no cron jobs remain that call the cleanup function ───────────────
-- (Run this SELECT separately to confirm — it should return 0 rows)
-- SELECT jobname, schedule, command FROM cron.job
-- WHERE command ILIKE '%delete_expired_anonymous_profiles%';

-- ── 3. Keep the function but add a clear notice it's no longer auto-scheduled ──
-- The function is preserved so an admin can still call it manually if needed.
COMMENT ON FUNCTION public.delete_expired_anonymous_profiles() IS
  'Manually deletes anonymous user accounts older than 1 hour. '
  'NOTE: This function is NO LONGER called automatically. '
  'Visitor sessions are now persisted via browser localStorage. '
  'Only run this manually if you need to hard-reset all guest accounts.';

-- ── 4. (Optional) Drop the index used only for cleanup scheduling ──────────────
-- The idx_profiles_anonymous_cleanup index was created to speed up the
-- scheduled DELETE query. Since that job no longer runs, the index is
-- no longer needed for performance. Drop it to reclaim space.
-- Uncomment the line below if you want to remove it:
-- DROP INDEX IF EXISTS public.idx_profiles_anonymous_cleanup;

-- ── 5. Confirm anonymous users in auth.users will NOT be auto-expired ─────────
-- Supabase has a built-in "anonymous users expiry" setting in the Auth dashboard.
-- Go to: Authentication > Providers > Anonymous Sign-ins
-- Make sure "Auto clean up anonymous users" is DISABLED (or set to never expire).
-- This SQL alone does not control that Supabase dashboard setting.

-- Done! Anonymous visitor accounts are now permanent until manually removed.
