-- ============================================================
-- SQL Schema Update: Allow Admins to Update User Passwords
-- Run this in your Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_user_password(user_id uuid, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth, extensions
AS $$
BEGIN
  -- 1. Check if caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update user passwords.';
  END IF;

  -- 2. Validate password length
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'Invalid: Password must be at least 6 characters.';
  END IF;

  -- 3. Update auth.users encrypted password
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = user_id;
END;
$$;

-- Grant execution permission to authenticated role
GRANT EXECUTE ON FUNCTION public.update_user_password(uuid, text) TO authenticated;
