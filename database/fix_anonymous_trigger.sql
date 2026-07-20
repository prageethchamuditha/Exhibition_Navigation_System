-- ============================================================
-- SQL Schema Update: Fix Anonymous User Detection in Trigger
-- Run this in your Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- 1. Update the new user trigger function to natively read
--    the `is_anonymous` column from Supabase auth.users
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
    coalesce(new.is_anonymous, false) -- Reads natively from auth.users.is_anonymous
  );
  return new;
end;
$$;

-- 2. Backfill/correct existing profiles where the user was
--    incorrectly marked as registered instead of anonymous guest
update public.profiles
set is_anonymous = true
where id in (
  select id from auth.users
  where is_anonymous = true
);
