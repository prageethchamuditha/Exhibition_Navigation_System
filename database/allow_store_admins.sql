-- ============================================================
-- SQL Schema Update: Allow Store Administrators to Manage Stores
-- Run this in your Supabase SQL Editor (Settings > SQL Editor)
-- ============================================================

-- 1. HELPER FUNCTION TO CHECK IF CURRENT USER IS STORE_ADMIN
CREATE OR REPLACE FUNCTION public.is_store_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT exists (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'store_admin'
  );
$$;

-- 2. ADD POLICIES ON PUBLIC.STORES
-- Store admins can read their owned stores (even if inactive)
DROP POLICY IF EXISTS "Store admins can read owned stores" ON public.stores;
CREATE POLICY "Store admins can read owned stores"
  ON public.stores FOR SELECT
  USING (public.is_store_admin() AND created_by = auth.uid());

-- Store admins can update their owned stores
DROP POLICY IF EXISTS "Store admins can update owned stores" ON public.stores;
CREATE POLICY "Store admins can update owned stores"
  ON public.stores FOR UPDATE
  USING (public.is_store_admin() AND created_by = auth.uid())
  WITH CHECK (public.is_store_admin() AND created_by = auth.uid());


-- 3. ADD POLICIES ON PUBLIC.STORE_IMAGES
-- Store admins can manage (insert/update/delete) images for stores they own
DROP POLICY IF EXISTS "Store admins can manage owned store images" ON public.store_images;
CREATE POLICY "Store admins can manage owned store images"
  ON public.store_images FOR ALL
  USING (
    public.is_store_admin() AND 
    exists (
      SELECT 1 FROM public.stores 
      WHERE id = store_images.store_id AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_store_admin() AND 
    exists (
      SELECT 1 FROM public.stores 
      WHERE id = store_images.store_id AND created_by = auth.uid()
    )
  );


-- 4. ADD POLICIES ON PUBLIC.PROMOTIONS
-- Store admins can manage (insert/update/delete) promotions for stores they own
DROP POLICY IF EXISTS "Store admins can manage owned promotions" ON public.promotions;
CREATE POLICY "Store admins can manage owned promotions"
  ON public.promotions FOR ALL
  USING (
    public.is_store_admin() AND 
    exists (
      SELECT 1 FROM public.stores 
      WHERE id = promotions.store_id AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_store_admin() AND 
    exists (
      SELECT 1 FROM public.stores 
      WHERE id = promotions.store_id AND created_by = auth.uid()
    )
  );
