-- ============================================================
-- Exhibition Navigation System — Add Email to Profiles
-- Run this in your Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- 1. ADD EMAIL COLUMN TO PROFILES TABLE
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. UPDATE TRIGGER FUNCTION TO AUTOMATICALLY POPULATE EMAIL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, is_anonymous)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Visitor'),
    new.email,
    coalesce((new.raw_user_meta_data->>'is_anonymous')::boolean, false)
  );
  RETURN new;
END;
$$;

-- 3. BACKFILL EMAIL COLUMN FOR EXISTING USERS
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
