-- ==========================================================================
-- E-BUS CONNECT UGANDA — STEP A PATCHES: SECURITY HARDENING
-- Run this in your Supabase SQL Editor after 001_schema_and_rls.sql
-- ==========================================================================

SET check_function_bodies = off;

-- PATCH 1: first-admin fix + trim profile data at sign-up
CREATE OR REPLACE FUNCTION public.block_self_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'You cannot change your user ID.';
  END IF;
  -- auth.uid() is NULL in the SQL Editor/dashboard, so only logged-in app users are checked
  IF auth.uid() IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only an administrator can change user roles.';
    END IF;
    IF NEW.id = auth.uid() THEN
      RAISE EXCEPTION 'Admins cannot change their own role for safety.';
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (NEW.id,
          left(COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''), 100),
          left(COALESCE(NEW.raw_user_meta_data ->> 'phone', ''), 20),
          'passenger');
  RETURN NEW;
END; $$;

-- PATCH 2: users can edit ONLY name and phone on their own profile
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_name_len CHECK (char_length(full_name) <= 100),
  ADD CONSTRAINT profiles_phone_len CHECK (char_length(phone) <= 20);

-- PATCH 3: bookings
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_bus_id_seat_status_key;
ALTER TABLE public.bookings ALTER COLUMN bus_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_active_seat
  ON public.bookings (bus_id, seat) WHERE status = 'confirmed';

DROP POLICY IF EXISTS bookings_insert ON public.bookings;
DROP POLICY IF EXISTS bookings_update ON public.bookings;
CREATE POLICY bookings_update_admin ON public.bookings
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.book_seat(
  p_route_id uuid, p_bus_id uuid, p_seat text, p_origin_stop uuid, p_dest_stop uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_booking_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book a seat.';
  END IF;
  IF p_seat !~ '^[1-9][0-9]?[A-D]$' THEN
    RAISE EXCEPTION 'Invalid seat number: %', p_seat;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.buses b JOIN public.routes r ON r.id = b.route_id
    WHERE b.id = p_bus_id AND b.route_id = p_route_id AND r.status = 'active'
  ) THEN
    RAISE EXCEPTION 'That bus is not available on this route.';
  END IF;

  INSERT INTO public.bookings (user_id, route_id, bus_id, seat, origin_stop, dest_stop, status)
  VALUES (v_user_id, p_route_id, p_bus_id, p_seat, p_origin_stop, p_dest_stop, 'confirmed')
  RETURNING id INTO v_booking_id;
  RETURN v_booking_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Seat % is already booked on this bus. Please choose another.', p_seat;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;
  UPDATE public.bookings SET status = 'cancelled'
  WHERE id = p_booking_id AND user_id = auth.uid() AND status = 'confirmed';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or cannot be cancelled.';
  END IF;
END; $$;

-- PATCH 4: alerts (admins see all; expired alerts hidden from others)
DROP POLICY IF EXISTS alerts_select ON public.alerts;
CREATE POLICY alerts_select ON public.alerts FOR SELECT USING (
  public.is_admin()
  OR (is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (target_role = 'all' OR target_role = public.get_my_role()))
);

-- PATCH 5: waiting requests, bus locations, driver bus status
DROP POLICY IF EXISTS waiting_insert ON public.waiting_requests;
CREATE POLICY waiting_insert ON public.waiting_requests
  FOR INSERT WITH CHECK (status = 'active');

ALTER TABLE public.bus_locations
  ADD CONSTRAINT bus_loc_lat CHECK (lat BETWEEN -90 AND 90),
  ADD CONSTRAINT bus_loc_lng CHECK (lng BETWEEN -180 AND 180);

DROP POLICY IF EXISTS bus_locations_insert ON public.bus_locations;
CREATE POLICY bus_locations_insert ON public.bus_locations FOR INSERT WITH CHECK (
  public.is_admin()
  OR (public.is_driver() AND bus_id IN (
        SELECT d.bus_id FROM public.drivers d
        WHERE d.user_id = auth.uid() AND d.active = true))
);

CREATE OR REPLACE FUNCTION public.driver_set_bus_status(p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_driver() THEN
    RAISE EXCEPTION 'Permission denied: driver role required.';
  END IF;
  IF p_status NOT IN ('in-service','charging','idle','maintenance') THEN
    RAISE EXCEPTION 'Invalid status.';
  END IF;
  UPDATE public.buses SET status = p_status
  WHERE id = (SELECT d.bus_id FROM public.drivers d
              WHERE d.user_id = auth.uid() AND d.active = true);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No bus is assigned to you.';
  END IF;
END; $$;

-- PATCH 6: only logged-in users may call these functions
-- (do NOT do this for is_admin / is_driver / get_my_role, the policies need them)
REVOKE EXECUTE ON FUNCTION public.book_seat(uuid,uuid,text,uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_booking(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.driver_set_bus_status(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_all_payments() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_seat(uuid,uuid,text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_set_bus_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid,text) TO authenticated;
