-- ============================================================
-- SQL Schema Update: Allow Admins to Create New Users
-- Run this in your Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_new_user(
  username_or_email text,
  password_text text,
  display_name_text text,
  phone_text text,
  role_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth, extensions
AS $$
DECLARE
  new_user_id uuid;
  formatted_email text;
BEGIN
  -- 1. Check if caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create new users.';
  END IF;

  -- 2. Format email identifier
  formatted_email := trim(username_or_email);
  IF position('@' in formatted_email) = 0 THEN
    formatted_email := formatted_email || '@exnav.local';
  END IF;

  -- 3. Check if email is already taken
  IF exists (SELECT 1 FROM auth.users WHERE email = formatted_email) THEN
    RAISE EXCEPTION 'Conflict: The username or email is already taken.';
  END IF;

  -- 4. Validate password length
  IF length(password_text) < 6 THEN
    RAISE EXCEPTION 'Invalid: Password must be at least 6 characters.';
  END IF;

  -- 5. Generate UUID and insert into auth.users
  new_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    is_super_admin
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    formatted_email,
    crypt(password_text, gen_salt('bf')),
    now(),
    NULL,
    NULL,
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('name', display_name_text, 'is_anonymous', false),
    now(),
    now(),
    '',
    '',
    '',
    '',
    false
  );

  -- 6. Update the created profile (trigger handle_new_user ran after insert on auth.users)
  UPDATE public.profiles
  SET role = role_text,
      phone = nullif(trim(phone_text), '')
  WHERE id = new_user_id;

  RETURN new_user_id;
END;
$$;

-- Grant execution permission to authenticated role
GRANT EXECUTE ON FUNCTION public.create_new_user(text, text, text, text, text) TO authenticated;
