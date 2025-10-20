-- ============================================================================
-- Migration: Switch to Apple IAP-only trial system
-- ============================================================================
-- This migration removes the automatic 30-day trial and switches to Apple IAP
-- Run this in your Supabase SQL Editor to update your existing database
-- ============================================================================

-- Update the profiles table to make trial dates optional and add 'none' status
ALTER TABLE public.profiles
  ALTER COLUMN trial_started_at DROP NOT NULL,
  ALTER COLUMN trial_started_at DROP DEFAULT,
  ALTER COLUMN trial_ends_at DROP NOT NULL,
  ALTER COLUMN trial_ends_at DROP DEFAULT;

-- Drop the old constraint
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

-- Add new constraint with 'none' status
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('none', 'trial', 'active', 'expired', 'cancelled'));

-- Update existing users to 'none' status (they'll need to subscribe through Apple)
-- Comment this out if you want to keep existing users' trial status
-- UPDATE public.profiles SET subscription_status = 'none';

-- ============================================================================
-- Migration Complete!
-- ============================================================================
-- Your database is now configured for Apple IAP-only trials.
-- Existing users will keep their current status unless you uncommented the UPDATE.
-- New users will start with subscription_status = 'none'.
-- ============================================================================
