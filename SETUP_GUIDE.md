# MileMate Setup Guide - Authentication & Cloud Sync

This guide will walk you through setting up authentication and cloud sync for your MileMate app.

## Progress: Authentication System ✅

**What's been completed:**
- ✅ Supabase client configuration
- ✅ Authentication service (sign up, sign in, sign out)
- ✅ Authentication context and hooks
- ✅ Sign-in and Sign-up screens
- ✅ Auth gate in app navigation
- ✅ 14-day trial tracking in database schema

**What's next:**
- ⏳ Trip sync service
- ⏳ RevenueCat subscription integration
- ⏳ Paywall screen

---

## Step 1: Set Up Supabase Project

### 1.1 Create Supabase Account

1. Go to https://supabase.com
2. Click **"Start your project"** or **"Sign Up"**
3. Sign up with GitHub, Google, or email

### 1.2 Create a New Project

1. Click **"New Project"**
2. Select or create an **Organization**
3. Fill in project details:
   - **Name:** MileMate (or whatever you prefer)
   - **Database Password:** Generate a strong password and **save it somewhere safe**
   - **Region:** Choose closest to your target users (e.g., US East, West, EU West)
   - **Pricing Plan:** **Free** (500MB database, 2GB bandwidth, perfect to start)
4. Click **"Create new project"**
5. Wait 2-3 minutes for provisioning

### 1.3 Get Your API Credentials

1. In your Supabase project dashboard, click **"Project Settings"** (gear icon in sidebar)
2. Click **"API"** in the settings menu
3. You'll see two important values:

   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

4. **Copy both of these values** - you'll paste them in the next step

---

## Step 2: Configure Your App

### 2.1 Add Supabase Credentials to .env

1. Open **`.env`** in the root of your project (already created)
2. Replace the placeholder values with your actual credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3...
```

3. **Save the file**

⚠️ **Important:** The `.env` file is in `.gitignore` so your credentials won't be committed to git.

---

## Step 3: Set Up Database Schema

### 3.1 Run the SQL Schema

1. In your Supabase dashboard, click **"SQL Editor"** in the sidebar
2. Click **"New query"**
3. Open the file **`supabase-schema.sql`** in your project folder
4. **Copy the entire contents** of that file
5. **Paste it** into the Supabase SQL Editor
6. Click **"Run"** or press **Cmd/Ctrl + Enter**

You should see a success message. This creates:
- ✅ `profiles` table (user profiles with trial tracking)
- ✅ `trips` table (cloud-synced trips)
- ✅ Row Level Security (RLS) policies
- ✅ Automatic triggers for timestamps
- ✅ Auto-profile creation on signup

### 3.2 Verify Tables Were Created

1. Click **"Table Editor"** in the sidebar
2. You should see two tables:
   - `profiles`
   - `trips`

---

## Step 4: Test Authentication

### 4.1 Run the App

```bash
npx expo start
```

### 4.2 Sign Up for a New Account

1. The app will now show the **Sign In** screen first (since you're not authenticated)
2. Click **"Sign Up"**
3. Enter:
   - Email: your@email.com
   - Password: (at least 6 characters)
   - Confirm Password: (same password)
4. Click **"Start Free Trial"**

### 4.3 Verify Account Creation

1. You should see a success message: "Your 14-day free trial starts now!"
2. The app should navigate to onboarding (if not completed) or tabs (if completed)
3. In Supabase dashboard:
   - Go to **Authentication** → **Users**
   - You should see your new user account
   - Go to **Table Editor** → **profiles**
   - You should see a profile row with `trial_started_at` and `trial_ends_at` set

### 4.4 Test Sign Out & Sign In

1. In the app, go to **Settings** tab
2. You'll need to add a sign-out button (we'll do this next)
3. For now, you can test by:
   - Deleting the app and reinstalling
   - Or using the sign-in screen directly

---

## Current Authentication Features

### ✅ What Works Now

1. **Sign Up**
   - Creates user account in Supabase Auth
   - Automatically creates profile with 14-day trial
   - Secure token storage using Expo Secure Store

2. **Sign In**
   - Email and password authentication
   - Persistent sessions (stays logged in)
   - Auto-refresh tokens

3. **Auth State Management**
   - Global auth context available via `useAuth()` hook
   - Automatic navigation based on auth state
   - Protected routes (can't access tabs without auth)

4. **Trial Tracking**
   - 14-day trial starts on signup
   - Trial end date calculated automatically
   - Profile stores subscription status

### 📋 Usage in Your Code

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return <Text>Loading...</Text>;
  }

  if (!user) {
    return <Text>Please sign in</Text>;
  }

  return (
    <View>
      <Text>Email: {user.email}</Text>
      <Text>Trial ends: {profile?.trial_ends_at}</Text>
      <Button title="Sign Out" onPress={signOut} />
    </View>
  );
}
```

---

## Next Steps

Now that authentication is working, here's what we need to build next:

### 1. Add Sign Out Button to Settings ⏳
Update `app/(tabs)/settings.tsx` to include:
- User email display
- Sign out button
- Trial status (days remaining)

### 2. Trip Sync Service ⏳
Create `services/syncService.ts` that:
- Uploads new trips to Supabase
- Downloads trips from cloud
- Handles conflict resolution
- Syncs on app start and trip changes

### 3. Update Trip CRUD Operations ⏳
Modify `services/tripService.ts` to:
- Sync trips to cloud when created/updated/deleted
- Pull trips from cloud on app start
- Handle offline mode gracefully

### 4. RevenueCat Integration ⏳
- Set up RevenueCat account
- Configure App Store Connect products
- Add subscription service
- Create paywall screen
- Implement trial expiration handling

### 5. Feature Gating ⏳
Add checks throughout the app:
- Disable premium features if trial expired and no subscription
- Show upgrade prompts
- Handle graceful degradation

---

## Troubleshooting

### "Error: supabaseUrl is required"
- Make sure you've added credentials to `.env`
- Restart the Expo dev server: `npx expo start -c`

### "Error: Failed to fetch"
- Check your internet connection
- Verify the Supabase URL is correct
- Check Supabase project is not paused (free tier auto-pauses after 7 days of inactivity)

### "Row Level Security policy violation"
- Make sure you ran the SQL schema in Supabase
- Check that RLS policies were created in **Table Editor** → **Policies**

### Auth not persisting between app restarts
- Expo Secure Store should handle this automatically
- Make sure you're testing on a real device or simulator (not web)

---

## Files Created

### Services
- `services/supabase.ts` - Supabase client configuration
- `services/authService.ts` - Authentication functions

### Contexts
- `contexts/AuthContext.tsx` - Global auth state management

### Screens
- `app/auth/sign-in.tsx` - Sign in screen
- `app/auth/sign-up.tsx` - Sign up screen
- `app/auth/_layout.tsx` - Auth stack navigator

### Configuration
- `.env` - Supabase credentials (add your own values)
- `.env.example` - Example environment file
- `supabase-schema.sql` - Database schema to run in Supabase

### Updated
- `app/_layout.tsx` - Added AuthProvider and auth gate
- `.gitignore` - Added `.env` to ignore list

---

## Ready to Continue?

Once you've:
1. ✅ Created your Supabase project
2. ✅ Added credentials to `.env`
3. ✅ Run the SQL schema in Supabase
4. ✅ Tested sign up and sign in

You're ready to move on to implementing trip sync!

Let me know when you're ready and I'll build:
- Trip sync service
- Cloud upload/download for trips
- Settings screen updates (sign out, trial status)
- Conflict resolution for multi-device sync
