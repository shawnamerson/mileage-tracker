-- Add Apple IAP columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS apple_product_id text,
ADD COLUMN IF NOT EXISTS apple_environment text;
