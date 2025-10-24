-- Create a PostgreSQL function for atomic vehicle mileage updates
-- This prevents race conditions when multiple trips complete simultaneously

CREATE OR REPLACE FUNCTION increment_vehicle_mileage(
  vehicle_id_param uuid,
  miles_to_add numeric
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  make text,
  model text,
  year text,
  initial_mileage numeric,
  current_mileage numeric,
  bluetooth_device_id text,
  bluetooth_device_name text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atomically increment the mileage and return the updated vehicle
  RETURN QUERY
  UPDATE vehicles
  SET
    current_mileage = current_mileage + miles_to_add,
    updated_at = now()
  WHERE vehicles.id = vehicle_id_param
  RETURNING
    vehicles.id,
    vehicles.user_id,
    vehicles.name,
    vehicles.make,
    vehicles.model,
    vehicles.year,
    vehicles.initial_mileage,
    vehicles.current_mileage,
    vehicles.bluetooth_device_id,
    vehicles.bluetooth_device_name,
    vehicles.is_active,
    vehicles.created_at,
    vehicles.updated_at;
END;
$$;

-- Add a comment explaining the function
COMMENT ON FUNCTION increment_vehicle_mileage IS
  'Atomically increments vehicle mileage to prevent race conditions when multiple trips complete simultaneously';
