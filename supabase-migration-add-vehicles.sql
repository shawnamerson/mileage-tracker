-- ============================================================================
-- Migration: Add Vehicles Table for Cloud Storage
-- ============================================================================
-- This migration adds a vehicles table to Supabase for cloud-based storage
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. CREATE VEHICLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,

  -- Vehicle details
  name text not null,
  make text,
  model text,
  year text,

  -- Mileage tracking
  initial_mileage real not null default 0,
  current_mileage real not null default 0,

  -- Bluetooth integration (optional)
  bluetooth_device_id text,
  bluetooth_device_name text,

  -- Active vehicle flag
  is_active boolean default false,

  -- Timestamps
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Constraints
  check (initial_mileage >= 0),
  check (current_mileage >= initial_mileage)
);

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================================================
alter table public.vehicles enable row level security;

-- Policy: Users can only view their own vehicles
create policy "Users can view own vehicles"
  on public.vehicles for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own vehicles
create policy "Users can insert own vehicles"
  on public.vehicles for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own vehicles
create policy "Users can update own vehicles"
  on public.vehicles for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own vehicles
create policy "Users can delete own vehicles"
  on public.vehicles for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
create index vehicles_user_id_idx on public.vehicles(user_id);
create index vehicles_is_active_idx on public.vehicles(is_active);
create index vehicles_created_at_idx on public.vehicles(created_at);

-- ============================================================================
-- 4. CREATE TRIGGER FOR updated_at
-- ============================================================================
create trigger handle_vehicles_updated_at
  before update on public.vehicles
  for each row
  execute function public.handle_updated_at();

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================
grant all on public.vehicles to anon, authenticated;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- Your vehicles table is now ready.
-- Data will be properly isolated by user_id.
-- ============================================================================
