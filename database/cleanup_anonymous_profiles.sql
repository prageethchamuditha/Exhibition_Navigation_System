-- ============================================================
-- SQL Schema Update: Cleanup Expired Anonymous Profiles
-- Run this in your Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- Create a secure PostgreSQL function to delete anonymous users
-- that signed up more than 1 hour ago.
create or replace function public.delete_expired_anonymous_profiles()
returns void
security definer
set search_path = public, auth
language plpgsql
as $$
begin
  -- Delete from auth.users which cascades to public.profiles and public.visitor_locations
  delete from auth.users
  where id in (
    select id from public.profiles
    where is_anonymous = true
    and created_at < (now() - interval '1 hour')
  );

  -- Delete stale anonymous visitor locations (older than 1 hour)
  delete from public.visitor_locations
  where user_id is null
  and updated_at < (now() - interval '1 hour');
end;
$$;

-- Grant execution permission to authenticated and anonymous roles
grant execute on function public.delete_expired_anonymous_profiles() to authenticated;
grant execute on function public.delete_expired_anonymous_profiles() to anon;
