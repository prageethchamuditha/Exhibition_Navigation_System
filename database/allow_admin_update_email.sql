-- ============================================================
-- SQL Schema Update: Allow Admins to Update User Emails
-- Run this in your Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_user_email(user_id uuid, new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update user emails.';
  END IF;

  -- Validate email format
  IF position('@' in new_email) = 0 THEN
    RAISE EXCEPTION 'Invalid: Email or username format is incorrect.';
  END IF;

  -- Check if email is already taken
  IF exists (SELECT 1 FROM auth.users WHERE email = new_email AND id != user_id) THEN
    RAISE EXCEPTION 'Conflict: The username or email is already taken.';
  END IF;

  -- Update auth.users email
  UPDATE auth.users
  SET email = new_email,
      email_confirmed_at = now(),
      updated_at = now()
  WHERE id = user_id;

  -- Update public.profiles email
  UPDATE public.profiles
  SET email = new_email,
      updated_at = now()
  WHERE id = user_id;
END;
$$;

-- Grant execution permission to authenticated role
GRANT EXECUTE ON FUNCTION public.update_user_email(uuid, text) TO authenticated;
