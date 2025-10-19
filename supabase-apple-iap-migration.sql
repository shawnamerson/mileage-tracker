-- ============================================================================
-- Apple IAP Migration
-- ============================================================================
-- This migration adds support for Apple In-App Purchases to existing databases
--
-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the sidebar
-- 3. Click "New query"
-- 4. Paste this entire file
-- 5. Click "Run" or press Cmd/Ctrl + Enter
-- ============================================================================

-- Add apple_transaction_id column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS apple_transaction_id text;

-- Update comment on subscription_status column
COMMENT ON COLUMN public.profiles.subscription_status IS 'Subscription status managed by Apple IAP';

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- Your database now supports Apple In-App Purchases.
-- The apple_transaction_id column will store Apple transaction IDs.
-- ============================================================================
