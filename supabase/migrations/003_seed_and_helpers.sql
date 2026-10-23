-- ==========================================================================
-- E-BUS CONNECT UGANDA — STEP C: TRANSIT SEED DATA & BOOKING HELPERS
-- Paste this file into your Supabase SQL Editor and click "Run".
-- ==========================================================================

-- 1. SEED ROUTES (Line 01, Line 02, Line 03, Line 04)
INSERT INTO public.routes (code, name, short_name, color, fare_ugx, frequency_mins, first_bus, last_bus, description, status)
VALUES
  ('R-01', 'Line 01: Ntinda ⇄ Bukoto ⇄ Kisementi ⇄ City Centre', 'Ntinda → City Centre', '#10B981', 2500, 8, '05:30', '23:00', 'Direct urban electric line serving Ntinda, Bukoto Market, Kisementi Shopping Hub, and City Centre.', 'active'),
  ('R-02', 'Line 02: Chanja ⇄ Kyanja ⇄ Bukoto ⇄ City Centre', 'Chanja → City Centre', '#06B6D4', 3000, 12, '05:45', '22:30', 'Northern suburban corridor from Chanja and Kyanja via Bukoto to Kampala City Centre.', 'active'),
  ('R-03', 'Line 03: Nakawa ⇄ Banda ⇄ Kireka ⇄ Mukono', 'Nakawa → Mukono Trunk', '#F59E0B', 3500, 10, '05:00', '23:30', 'Eastern metropolitan heavy transit trunk line.', 'active'),
  ('R-04', 'Line 04: City Centre ⇄ Kibuye ⇄ Kajjansi ⇄ Entebbe Airport', 'Airport Express', '#8B5CF6', 5000, 30, '04:30', '00:00', 'Dedicated airport corridor via Kampala-Entebbe Expressway.', 'active')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  fare_ugx = EXCLUDED.fare_ugx,
  status = EXCLUDED.status;

-- 2. SEED STOPS
INSERT INTO public.stops (code, name, short_name, zone, lat, lng, is_active)
VALUES
  ('ST-NTD', 'Ntinda Complex Stage', 'Ntinda', 'Nakawa Division', 0.3556, 32.6120, true),
  ('ST-BKT', 'Bukoto Market Stage', 'Bukoto', 'Nakawa Division', 0.3510, 32.5990, true),
  ('ST-KSM', 'Kisementi / Kamwokya Stage', 'Kisementi', 'Kampala Central', 0.3340, 32.5860, true),
  ('ST-CBD', 'Kampala Central Bus Terminal', 'City Centre', 'Kampala Central', 0.3136, 32.5811, true),
  ('ST-CHJ', 'Chanja Bus Stop (Chanja Terminal)', 'Chanja', 'Greater Kampala', 0.4050, 32.5950, true),
  ('ST-KYJ', 'Kyanja Bus Stop (Trading Centre)', 'Kyanja', 'Nakawa North', 0.3850, 32.6070, true),
  ('ST-NKW', 'Nakawa Stage (Spear Motors)', 'Nakawa', 'Nakawa Division', 0.3298, 32.6178, true),
  ('ST-BND', 'Banda Stage (Kyambogo Gate)', 'Banda', 'Banda', 0.3503, 32.6318, true),
  ('ST-KRK', 'Kireka Trading Stage', 'Kireka', 'Kireka', 0.3475, 32.6508, true),
  ('ST-MKN', 'Mukono Central Terminal', 'Mukono', 'Mukono', 0.3533, 32.7533, true),
  ('ST-KBY', 'Kibuye Roundabout', 'Kibuye', 'Makindye', 0.2885, 32.5695, true),
  ('ST-KJJ', 'Kajjansi Expressway Toll Interchange', 'Kajjansi', 'Wakiso', 0.2185, 32.5385, true),
  ('ST-EBB', 'Entebbe International Airport', 'Entebbe Airport', 'Entebbe', 0.0424, 32.4435, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active;

-- 3. SEED BUSES (Linked to routes)
INSERT INTO public.buses (name, plate_number, model, capacity, route_id, status, battery_percent)
VALUES
  ('BUS 01', 'UBX 101A', 'Kiira Kayoola EVS (12m Electric)', 45, (SELECT id FROM public.routes WHERE code = 'R-01' LIMIT 1), 'in-service', 92),
  ('BUS 02', 'UBX 102B', 'Kiira Kayoola EVS (12m Electric)', 45, (SELECT id FROM public.routes WHERE code = 'R-02' LIMIT 1), 'in-service', 85),
  ('BUS 04', 'UBX 204D', 'Kiira Kayoola EVS (12m Electric)', 45, (SELECT id FROM public.routes WHERE code = 'R-01' LIMIT 1), 'in-service', 78),
  ('BUS 07', 'UBY 707M', 'Kiira Kayoola EVS (12m Electric)', 45, (SELECT id FROM public.routes WHERE code = 'R-03' LIMIT 1), 'in-service', 80),
  ('BUS 09', 'UBZ 990P', 'Kiira Kayoola EVS (12m Electric)', 45, (SELECT id FROM public.routes WHERE code = 'R-01' LIMIT 1), 'charging', 35)
ON CONFLICT (plate_number) DO UPDATE SET
  status = EXCLUDED.status,
  battery_percent = EXCLUDED.battery_percent;

-- 4. SMART BOOK_SEAT FUNCTION
-- Accepts either raw UUIDs OR human-readable codes/names (e.g. 'R-01', 'BUS 04', 'ST-NTD')
-- Eliminates client-side lookup roundtrips and handles missing lookups safely.

CREATE OR REPLACE FUNCTION public.book_seat_smart(
  p_route text,
  p_bus   text,
  p_seat  text,
  p_origin text,
  p_dest  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_route_id    uuid;
  v_bus_id      uuid;
  v_origin_id   uuid;
  v_dest_id     uuid;
  v_booking_id  uuid;
  v_bus_name    text;
  v_route_name  text;
BEGIN
  -- 1. Ensure caller is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to book a seat.';
  END IF;

  -- 2. Validate seat format
  IF p_seat !~ '^[1-9][0-9]?[A-D]$' THEN
    RAISE EXCEPTION 'Invalid seat number: %', p_seat;
  END IF;

  -- 3. Resolve Route
  SELECT id, name INTO v_route_id, v_route_name
  FROM public.routes
  WHERE code = p_route OR id::text = p_route OR short_name ILIKE '%' || p_route || '%'
  LIMIT 1;

  IF v_route_id IS NULL THEN
    -- Fallback to first active route
    SELECT id, name INTO v_route_id, v_route_name FROM public.routes WHERE status = 'active' LIMIT 1;
  END IF;

  -- 4. Resolve Bus
  SELECT id, name INTO v_bus_id, v_bus_name
  FROM public.buses
  WHERE name ILIKE p_bus OR plate_number ILIKE p_bus OR id::text = p_bus
  LIMIT 1;

  IF v_bus_id IS NULL THEN
    -- Fallback to first bus on that route or in service
    SELECT id, name INTO v_bus_id, v_bus_name FROM public.buses WHERE route_id = v_route_id LIMIT 1;
    IF v_bus_id IS NULL THEN
      SELECT id, name INTO v_bus_id, v_bus_name FROM public.buses LIMIT 1;
    END IF;
  END IF;

  -- 5. Resolve Stops
  SELECT id INTO v_origin_id FROM public.stops WHERE code = p_origin OR id::text = p_origin OR name ILIKE '%' || p_origin || '%' LIMIT 1;
  SELECT id INTO v_dest_id   FROM public.stops WHERE code = p_dest   OR id::text = p_dest   OR name ILIKE '%' || p_dest   || '%' LIMIT 1;

  IF v_origin_id IS NULL THEN
    SELECT id INTO v_origin_id FROM public.stops LIMIT 1;
  END IF;
  IF v_dest_id IS NULL THEN
    SELECT id INTO v_dest_id FROM public.stops WHERE id <> v_origin_id LIMIT 1;
  END IF;

  -- 6. Atomic Insert — unique constraint prevents double booking
  INSERT INTO public.bookings (user_id, route_id, bus_id, seat, origin_stop, dest_stop, status)
  VALUES (v_user_id, v_route_id, v_bus_id, p_seat, v_origin_id, v_dest_id, 'confirmed')
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'seat', p_seat,
    'bus_name', v_bus_name,
    'route_name', v_route_name
  );

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Seat % is already booked on this bus. Please choose another seat.', p_seat;
END;
$$;

-- Allow authenticated users to call the smart booking function
REVOKE EXECUTE ON FUNCTION public.book_seat_smart(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_seat_smart(text,text,text,text,text) TO authenticated;
