-- ============================================================================
-- MileMate Supabase Database Schema
-- ============================================================================
-- This file contains the complete database schema for MileMate
-- Run this in your Supabase SQL Editor to set up the database
--
-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the sidebar
-- 3. Click "New query"
-- 4. Paste this entire file
-- 5. Click "Run" or press Cmd/Ctrl + Enter
-- ============================================================================

-- ============================================================================
-- 1. CREATE PROFILES TABLE (extends auth.users)
-- ============================================================================
-- This table stores additional user information beyond what's in auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Trial tracking
  trial_started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  trial_ends_at timestamp with time zone default (timezone('utc'::text, now()) + interval '14 days') not null,

  -- Subscription status (will be managed by Apple IAP)
  subscription_status text default 'trial' check (subscription_status in ('trial', 'active', 'expired', 'cancelled')),
  subscription_expires_at timestamp with time zone,
  apple_transaction_id text
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Policy: Users can only read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Policy: Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================================
-- 2. CREATE TRIPS TABLE
-- ============================================================================
create table public.trips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,

  -- Trip details
  start_location text not null,
  end_location text not null,
  start_latitude real not null,
  start_longitude real not null,
  end_latitude real not null,
  end_longitude real not null,
  distance real not null check (distance >= 0),

  -- Timing
  start_time bigint not null, -- Unix timestamp in milliseconds
  end_time bigint not null,   -- Unix timestamp in milliseconds

  -- Categorization
  purpose text not null check (purpose in ('business', 'personal', 'medical', 'charity', 'other')),
  notes text,

  -- Timestamps
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  -- Sync tracking
  is_deleted boolean default false,
  deleted_at timestamp with time zone
);

-- Enable Row Level Security
alter table public.trips enable row level security;

-- Policy: Users can only see their own trips
create policy "Users can view own trips"
  on public.trips for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own trips
create policy "Users can insert own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own trips
create policy "Users can update own trips"
  on public.trips for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own trips (soft delete)
create policy "Users can delete own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
create index trips_user_id_idx on public.trips(user_id);
create index trips_start_time_idx on public.trips(start_time);
create index trips_purpose_idx on public.trips(purpose);
create index trips_created_at_idx on public.trips(created_at);
create index trips_is_deleted_idx on public.trips(is_deleted);

-- ============================================================================
-- 4. CREATE FUNCTION TO AUTOMATICALLY UPDATE updated_at
-- ============================================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

create trigger handle_trips_updated_at
  before update on public.trips
  for each row
  execute function public.handle_updated_at();

-- ============================================================================
-- 5. CREATE FUNCTION TO AUTOMATICALLY CREATE PROFILE ON SIGNUP
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger to auto-create profile
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant all on public.profiles to anon, authenticated;
grant all on public.trips to anon, authenticated;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- Your database is now ready to use.
--
-- Next steps:
-- 1. Verify the tables were created in the "Table Editor" section
-- 2. Update your .env file with your Supabase URL and anon key
-- 3. Run the app and try signing up!
-- ============================================================================
