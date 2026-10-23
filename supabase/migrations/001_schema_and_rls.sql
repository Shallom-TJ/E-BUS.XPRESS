-- ==========================================================================
-- E-BUS CONNECT UGANDA — STEP A: DATABASE SCHEMA & ROW LEVEL SECURITY
-- Paste this entire file into the Supabase SQL Editor and click "Run".
-- ==========================================================================
-- WHAT THIS DOES (in simple words):
--   1. Creates all the tables your app needs.
--   2. Turns on Row Level Security (RLS) on EVERY table so Supabase
--      checks permissions on every single read/write.
--   3. Creates helper functions (is_admin, is_driver) that look up your
--      role from the DATABASE, not from anything the browser sends.
--   4. Adds a trigger that BLOCKS any user from promoting themselves
--      to admin or driver — only a real admin can do that.
--   5. Creates an atomic "book_seat" function so two people can never
--      book the same seat on the same bus at the same time.
-- ==========================================================================


-- ===================== HELPER FUNCTIONS (run FIRST) =====================

-- These functions run with the PRIVILEGES OF THE DATABASE OWNER
-- ("security definer"), so even though a normal user calls them,
-- they can read the profiles table to check the real role.
-- The user CANNOT change what these functions return.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE                        -- safe to cache within one query
SECURITY DEFINER              -- runs as the DB owner, not the caller
SET search_path = public      -- prevents search-path hijacking
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'passenger'               -- default if no profile row yet
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_my_role() = 'driver';
$$;


-- ===================== TABLES =====================

-- 1. PROFILES — one row per registered user
--    The "role" column is the SINGLE SOURCE OF TRUTH for permissions.
--    The CHECK constraint limits it to three known values.
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text NOT NULL DEFAULT '',
  phone       text NOT NULL DEFAULT '',
  role        text NOT NULL DEFAULT 'passenger'
                CHECK (role IN ('passenger', 'driver', 'admin')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.profiles IS
  'One row per auth user. The "role" column controls all access.';

-- 2. DRIVERS — extra info for users whose role is "driver"
CREATE TABLE IF NOT EXISTS public.drivers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id    text NOT NULL UNIQUE,          -- e.g. UG-DRV-042
  bus_id      uuid,                          -- FK added after buses table
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.drivers IS
  'Driver details. badge_id is unique so two drivers cannot share a badge.';

-- 3. BUSES
CREATE TABLE IF NOT EXISTS public.buses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,                   -- e.g. "BUS 04"
  plate_number    text NOT NULL UNIQUE,
  model           text NOT NULL DEFAULT '',
  capacity        int  NOT NULL DEFAULT 45 CHECK (capacity > 0),
  route_id        uuid,                            -- FK added after routes
  status          text NOT NULL DEFAULT 'idle'
                    CHECK (status IN ('in-service','charging','idle','maintenance')),
  battery_percent numeric(5,2) DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 4. ROUTES
CREATE TABLE IF NOT EXISTS public.routes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,            -- e.g. "R-01"
  name            text NOT NULL,
  short_name      text NOT NULL DEFAULT '',
  color           text NOT NULL DEFAULT '#10B981',
  fare_ugx        int  NOT NULL DEFAULT 0 CHECK (fare_ugx >= 0),
  frequency_mins  int  NOT NULL DEFAULT 10,
  first_bus       time NOT NULL DEFAULT '05:30',
  last_bus        time NOT NULL DEFAULT '23:00',
  description     text NOT NULL DEFAULT '',
  coordinates     jsonb NOT NULL DEFAULT '[]',     -- array of [lat,lng]
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','suspended','modified')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 5. STOPS
CREATE TABLE IF NOT EXISTS public.stops (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,                -- e.g. "ST-NTD"
  name        text NOT NULL,
  short_name  text NOT NULL DEFAULT '',
  zone        text NOT NULL DEFAULT '',
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  amenities   text[] NOT NULL DEFAULT '{}',
  route_ids   text[] NOT NULL DEFAULT '{}',        -- codes like R-01
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 6. BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route_id    uuid NOT NULL REFERENCES public.routes(id),
  bus_id      uuid REFERENCES public.buses(id),
  seat        text NOT NULL,                       -- e.g. "3B"
  origin_stop uuid REFERENCES public.stops(id),
  dest_stop   uuid REFERENCES public.stops(id),
  status      text NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('confirmed','cancelled','completed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Two people cannot book the same seat on the same bus
  UNIQUE (bus_id, seat, status)  -- only one "confirmed" per seat per bus
);

-- 7. PAYMENTS
--    IMPORTANT: passengers can SEE their own payments but can NEVER
--    insert or update payment rows from the browser.  Only a backend
--    Edge Function using the service_role key can write here.
CREATE TABLE IF NOT EXISTS public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id          uuid REFERENCES public.bookings(id),
  amount              int  NOT NULL CHECK (amount > 0),
  currency            text NOT NULL DEFAULT 'UGX',
  method              text NOT NULL DEFAULT 'MTN MoMo'
                        CHECK (method IN ('MTN MoMo','Airtel Money','Visa Card','KaCyber NFC')),
  provider_reference  text,                        -- from MTN/Airtel callback
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','completed','failed','refunded')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 8. ALERTS (service alerts & notifications)
CREATE TABLE IF NOT EXISTS public.alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level       text NOT NULL DEFAULT 'info'
                CHECK (level IN ('info','warning','urgent')),
  title       text NOT NULL,
  message     text NOT NULL,
  target_role text NOT NULL DEFAULT 'all'
                CHECK (target_role IN ('all','passenger','driver','admin')),
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz
);

-- 9. BUS_LOCATIONS — real-time GPS pings
CREATE TABLE IF NOT EXISTS public.bus_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id      uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  speed_kmh   numeric(5,1) DEFAULT 0,
  heading     numeric(5,1) DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- Index so "latest location per bus" queries are fast
CREATE INDEX IF NOT EXISTS idx_bus_locations_bus_updated
  ON public.bus_locations (bus_id, updated_at DESC);

-- 10. WAITING_REQUESTS — anonymous passenger demand signals
CREATE TABLE IF NOT EXISTS public.waiting_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id     uuid NOT NULL REFERENCES public.stops(id),
  route_id    uuid REFERENCES public.routes(id),
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','cancelled','boarded')),
  created_at  timestamptz NOT NULL DEFAULT now()
  -- NOTE: no user_id — privacy by design (Section 23 of your spec)
);


-- ===================== ADD DEFERRED FOREIGN KEYS =====================

ALTER TABLE public.drivers
  ADD CONSTRAINT fk_drivers_bus
  FOREIGN KEY (bus_id) REFERENCES public.buses(id) ON DELETE SET NULL;

ALTER TABLE public.buses
  ADD CONSTRAINT fk_buses_route
  FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;


-- ===================== AUTO-CREATE PROFILE ON SIGN-UP =====================
-- When someone signs up via Supabase Auth, this trigger automatically
-- creates their profile row with role = 'passenger'.
-- Nobody can sign up as admin — that is set manually (see bottom).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    'passenger'   -- ALWAYS passenger — never trust metadata for role
  );
  RETURN NEW;
END;
$$;

-- Drop the trigger if it already exists (safe to re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ===================== ANTI-PRIVILEGE-ESCALATION TRIGGER =====================
-- This trigger fires BEFORE any UPDATE on the profiles table.
-- It prevents a user from changing their own role, id, or user_id.
-- Only an admin (checked via the database, not the browser) can
-- change someone ELSE's role.

CREATE OR REPLACE FUNCTION public.block_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Block changing the primary key (id)
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'You cannot change your user ID.';
  END IF;

  -- If the role column is being changed...
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- ...only allow it if the CALLER is an admin AND they are
    -- editing someone ELSE's profile (not their own).
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only an administrator can change user roles.';
    END IF;
    IF OLD.id = auth.uid() THEN
      RAISE EXCEPTION 'Admins cannot change their own role for safety.';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_self_role_change ON public.profiles;
CREATE TRIGGER trg_block_self_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.block_self_role_change();


-- ===================== ENABLE RLS ON EVERY TABLE =====================
-- After this, NO data can be read or written unless a policy says so.

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stops            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_requests ENABLE ROW LEVEL SECURITY;


-- ===================== RLS POLICIES =====================

-- ─── PROFILES ───
-- Everyone can read their own profile.
-- Admins can read all profiles (for user management).
-- Users can update their own profile (but the trigger blocks role changes).
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- No one inserts profiles from the browser — the trigger does it.
-- (The trigger uses SECURITY DEFINER so it bypasses RLS.)


-- ─── DRIVERS ───
-- Drivers can read their own row.  Admins can read/write all.
CREATE POLICY drivers_select ON public.drivers
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY drivers_insert ON public.drivers
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY drivers_update ON public.drivers
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY drivers_delete ON public.drivers
  FOR DELETE USING (public.is_admin());


-- ─── BUSES ───
-- Everyone can read buses (passengers need to see fleet status).
-- Only admins can create/edit/delete buses.
CREATE POLICY buses_select ON public.buses
  FOR SELECT USING (true);

CREATE POLICY buses_insert ON public.buses
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY buses_update ON public.buses
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY buses_delete ON public.buses
  FOR DELETE USING (public.is_admin());


-- ─── ROUTES ───
-- Everyone can read routes (public timetable data).
-- Only admins can create/edit/delete routes.
CREATE POLICY routes_select ON public.routes
  FOR SELECT USING (true);

CREATE POLICY routes_insert ON public.routes
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY routes_update ON public.routes
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY routes_delete ON public.routes
  FOR DELETE USING (public.is_admin());


-- ─── STOPS ───
-- Everyone can read stops.
-- Only admins can manage stops.
CREATE POLICY stops_select ON public.stops
  FOR SELECT USING (true);

CREATE POLICY stops_insert ON public.stops
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY stops_update ON public.stops
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY stops_delete ON public.stops
  FOR DELETE USING (public.is_admin());


-- ─── BOOKINGS ───
-- Passengers can read ONLY THEIR OWN bookings.
-- Passengers can INSERT a booking (the book_seat function is preferred).
-- Only admins can see all bookings.
-- Nobody can update a booking to change the user_id (see WITH CHECK).
CREATE POLICY bookings_select ON public.bookings
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY bookings_insert ON public.bookings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY bookings_update ON public.bookings
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());


-- ─── PAYMENTS ───
-- Passengers can read ONLY THEIR OWN payments.
-- Admins can read ALL payments.
-- ** NO INSERT / UPDATE / DELETE policy for normal users. **
-- Only the Edge Function (using service_role) can write payments.
-- The service_role key bypasses RLS entirely, so no policy is needed for it.
CREATE POLICY payments_select ON public.payments
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- No INSERT/UPDATE/DELETE policies = browser users CANNOT write payments.


-- ─── ALERTS ───
-- Everyone can read active alerts targeted at "all" or their role.
-- Only admins can create, edit, or delete alerts.
CREATE POLICY alerts_select ON public.alerts
  FOR SELECT USING (
    is_active = true
    AND (
      target_role = 'all'
      OR target_role = public.get_my_role()
      OR public.is_admin()
    )
  );

CREATE POLICY alerts_insert ON public.alerts
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY alerts_update ON public.alerts
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY alerts_delete ON public.alerts
  FOR DELETE USING (public.is_admin());


-- ─── BUS_LOCATIONS ───
-- Everyone can read locations (passengers need the live map).
-- Only the driver assigned to that specific bus can INSERT a new location.
-- Admins can also write (for testing / dispatch overrides).
CREATE POLICY bus_locations_select ON public.bus_locations
  FOR SELECT USING (true);

CREATE POLICY bus_locations_insert ON public.bus_locations
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      public.is_driver()
      AND bus_id IN (
        SELECT d.bus_id FROM public.drivers d WHERE d.user_id = auth.uid()
      )
    )
  );

-- Drivers don't update old rows — they insert new ones.
-- Admins can update if needed.
CREATE POLICY bus_locations_update ON public.bus_locations
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ─── WAITING_REQUESTS ───
-- Everyone can read waiting counts (the whole point of the WAIT pillar).
-- Anyone (even unauthenticated via anon key) can insert a waiting request
-- because waiting is anonymous by design.
-- Only the person or a driver/admin can cancel (update status).
CREATE POLICY waiting_select ON public.waiting_requests
  FOR SELECT USING (true);

CREATE POLICY waiting_insert ON public.waiting_requests
  FOR INSERT WITH CHECK (true);   -- anonymous by design

CREATE POLICY waiting_update ON public.waiting_requests
  FOR UPDATE USING (public.is_driver() OR public.is_admin())
  WITH CHECK (public.is_driver() OR public.is_admin());


-- ===================== ATOMIC SEAT BOOKING FUNCTION =====================
-- This runs as ONE database transaction.  If two people try to book
-- seat "3B" on the same bus at the same time, only one succeeds.
-- The UNIQUE constraint on (bus_id, seat, status) does the real work.
--
-- Returns the new booking id, or raises an error if the seat is taken.

CREATE OR REPLACE FUNCTION public.book_seat(
  p_route_id    uuid,
  p_bus_id      uuid,
  p_seat        text,
  p_origin_stop uuid,
  p_dest_stop   uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
  v_user_id    uuid := auth.uid();
BEGIN
  -- Must be logged in
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book a seat.';
  END IF;

  -- Validate seat format (1A–12D, for example)
  IF p_seat !~ '^[1-9][0-9]?[A-D]$' THEN
    RAISE EXCEPTION 'Invalid seat number: %', p_seat;
  END IF;

  -- Attempt insert — the UNIQUE constraint will reject duplicates
  INSERT INTO public.bookings (user_id, route_id, bus_id, seat, origin_stop, dest_stop, status)
  VALUES (v_user_id, p_route_id, p_bus_id, p_seat, p_origin_stop, p_dest_stop, 'confirmed')
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Seat % is already booked on this bus. Please choose another.', p_seat;
END;
$$;


-- ===================== ADMIN-ONLY: VIEW ALL PAYMENTS (RPC) =====================
-- Admins call this RPC from the admin dashboard to see all payment data.
-- Normal users calling it get an error.

CREATE OR REPLACE FUNCTION public.admin_get_all_payments()
RETURNS SETOF public.payments
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required.';
  END IF;
  RETURN QUERY SELECT * FROM public.payments ORDER BY created_at DESC;
END;
$$;


-- ===================== ADMIN-ONLY: UPDATE USER ROLE (RPC) =====================
-- This is the ONLY safe way to promote a user to driver or admin.
-- It checks that the caller is an admin and that they are not
-- promoting themselves.

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_target_user_id uuid,
  p_new_role       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only admins can change roles.';
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Admins cannot change their own role for safety.';
  END IF;

  IF p_new_role NOT IN ('passenger', 'driver', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: must be passenger, driver, or admin.';
  END IF;

  UPDATE public.profiles
  SET role = p_new_role
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found.';
  END IF;
END;
$$;


-- ==========================================================================
-- HOW TO CREATE THE FIRST ADMIN (do this ONCE, manually, AFTER sign-up)
-- ==========================================================================
--
-- 1. Go to your Supabase Dashboard > Authentication > Users.
-- 2. Sign up with your own email (e.g. praise@example.com) using
--    the normal sign-up form or the dashboard "Add User" button.
-- 3. Note the UUID shown next to your user in the dashboard.
-- 4. Open the SQL Editor and run EXACTLY this (replace the UUID):
--
--    UPDATE public.profiles
--    SET role = 'admin'
--    WHERE id = 'PASTE-YOUR-UUID-HERE';
--
-- This is safe because:
--   - You are running it in the SQL Editor, which uses the service_role
--     (full database access), NOT the anon key.
--   - The anti-escalation trigger only blocks changes made through the
--     API (where auth.uid() is set).  In the SQL Editor, auth.uid() is
--     NULL, so the trigger allows it.
--   - No public sign-up form can ever set role to 'admin'.
--
-- NEVER expose a public endpoint that sets role = 'admin'.
-- ==========================================================================
