-- ============================================================
-- Exhibition Navigation System — Admin User Management Policies
-- Run this in Supabase SQL Editor to allow admins to manage users
-- ============================================================

-- 1. PROFILES UPDATE & DELETE POLICIES
-- Drop existing update policy for admins if it exists (though normally it does not)
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "Admins can delete profiles" on public.profiles;

-- Create update policy for admins
create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- Create delete policy for admins
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

-- Ensure delete permission is granted to authenticated users
grant delete on public.profiles to authenticated;


-- 2. VISITOR LOCATIONS DELETE POLICY
-- Drop existing delete policy for admins if it exists
drop policy if exists "Admins can delete visitor locations" on public.visitor_locations;

-- Create delete policy for admins
create policy "Admins can delete visitor locations"
  on public.visitor_locations for delete
  using (public.is_admin());

-- Ensure delete permission is granted to authenticated users
grant delete on public.visitor_locations to authenticated;


-- 3. SECURE RPC TO DELETE USER FROM AUTH.USERS
create or replace function public.delete_user(user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Check if caller is admin
  if not public.is_admin() then
    raise exception 'Unauthorized: Only administrators can delete users.';
  end if;

  -- Prevent self-deletion
  if auth.uid() = user_id then
    raise exception 'Conflict: You cannot delete your own account.';
  end if;

  -- Delete from auth.users (cascades to profiles and visitor_locations)
  delete from auth.users where id = user_id;
end;
$$;
