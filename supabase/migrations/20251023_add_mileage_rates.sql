-- Create mileage_rates table in Supabase
-- Moving from local SQLite to cloud-only architecture

CREATE TABLE IF NOT EXISTS mileage_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL UNIQUE,
  rate numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups by year
CREATE INDEX IF NOT EXISTS idx_mileage_rates_year ON mileage_rates(year);

-- Insert IRS Standard Mileage Rates for Business Use
-- These are the official IRS rates
INSERT INTO mileage_rates (year, rate) VALUES
  (2018, 0.545),
  (2019, 0.580),
  (2020, 0.575),
  (2021, 0.560),
  (2022, 0.625),
  (2023, 0.655),
  (2024, 0.670),
  (2025, 0.700),
  (2026, 0.700)
ON CONFLICT (year) DO NOTHING;

-- Add comment
COMMENT ON TABLE mileage_rates IS 'IRS standard mileage rates for business use';
