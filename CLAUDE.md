# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MileMate** is a React Native mileage tracking app built with Expo. It allows users to track trips for tax deduction purposes (business, personal, medical, charity, other), with automatic location tracking, cloud sync via Supabase, and Apple In-App Purchase subscriptions.

**Key Technologies:**
- Expo SDK 54 with Expo Router (file-based routing)
- React Native 0.81.4 with React 19.1.0
- TypeScript 5.9.2
- Supabase (authentication, database, cloud storage)
- SQLite (local database via expo-sqlite)
- Apple Sign In & In-App Purchases (react-native-iap)
- Background location tracking (expo-location, expo-task-manager)

## Development Commands

### Essential Commands
```bash
# Install dependencies
npm install

# Start development server
npm start
# or
npx expo start

# Run on iOS simulator
npm run ios
# or
npx expo run:ios

# Run on Android emulator
npm run android
# or
npx expo run:android

# Lint code
npm run lint
# or
npx expo lint
```

### EAS Build & Deploy
```bash
# Build for iOS (development)
eas build --profile development --platform ios

# Build for iOS (preview/TestFlight)
eas build --profile preview --platform ios

# Build for iOS (production)
eas build --profile production --platform ios

# Submit to App Store
eas submit --platform ios --profile production
```

### Testing Environments
- **Simulator/Emulator**: IAP not supported, use mock data
- **TestFlight**: Full IAP support with sandbox environment
- **Production**: Live App Store with real payments

## Architecture

### App Structure

The app uses Expo Router's file-based routing with three main navigation groups:

1. **Auth Flow** (`app/auth/`): Sign in/sign up screens with Apple authentication
2. **Onboarding Flow** (`app/onboarding/`): First-time user setup after sign up
3. **Main App** (`app/(tabs)/`): Bottom tab navigation with 5 tabs:
   - Dashboard (`index.tsx`): Trip overview, active trip tracking, recent trips
   - Add Trip (`add.tsx`): Manual trip entry form
   - History (`history.tsx`): All past trips with filtering
   - Stats (`stats.tsx`): Analytics and charts
   - Settings (`settings.tsx`): App configuration, export, backup
4. **Subscription Flow** (`app/subscription/paywall.tsx`): Apple IAP paywall (modal)

**Navigation Logic** (`app/_layout.tsx`):
- Not authenticated → `/auth/sign-in`
- Authenticated but no onboarding → `/onboarding`
- Authenticated but trial expired/no subscription → `/subscription/paywall`
- Authenticated with active subscription/trial → `/(tabs)`

### Data Architecture

**Dual Storage System:**
- **Local**: SQLite database (`services/database.ts`) for offline access and fast reads
- **Cloud**: Supabase PostgreSQL for sync, backup, and multi-device support

**Data Flow:**
1. User creates/edits trip → saved to Supabase (primary)
2. `syncService.ts` handles bidirectional sync between local SQLite and Supabase
3. Local SQLite used in legacy code, newer code uses Supabase directly via `tripService.ts`

**Important Note**: There are two trip service implementations:
- `services/database.ts` + legacy local SQLite operations (being phased out)
- `services/tripService.ts` - Modern Supabase-first approach (preferred)

### Services Layer

All business logic lives in `services/`:

**Core Services:**
- `authService.ts` - User authentication (email + Apple Sign In)
- `tripService.ts` - Trip CRUD with Supabase (primary)
- `database.ts` - SQLite schema and migrations (legacy)
- `syncService.ts` - Bidirectional sync between local and cloud
- `supabase.ts` - Supabase client configuration

**Feature Services:**
- `subscriptionService.ts` - Apple IAP integration, paywall logic
- `locationService.ts` - GPS tracking, distance calculation
- `backgroundTracking.ts` - Background location tracking with expo-task-manager
- `autoTracking.ts` - Automatic trip detection
- `exportService.ts` - CSV/PDF export functionality
- `backupService.ts` - Data backup/restore
- `mileageRateService.ts` - IRS mileage rates by year
- `vehicleService.ts` - Vehicle management
- `notificationService.ts` - Push notifications
- `onboardingService.ts` - Onboarding state management

### Authentication & Authorization

**AuthContext** (`contexts/AuthContext.tsx`):
- Wraps entire app in `app/_layout.tsx`
- Provides: `{ session, user, profile, loading, signOut, refreshProfile }`
- Automatically syncs auth state with Supabase
- Initializes sync service on login

**Auth Flow:**
1. User signs in → Supabase creates session
2. AuthContext fetches user profile from `profiles` table
3. Profile includes: `trial_started_at`, `trial_ends_at`, `subscription_status`
4. Navigation logic checks these fields to determine which screen to show

### Subscription System

**Trial System:**
- New users get 7-day free trial (Apple IAP trial, not Supabase-only)
- Trial status stored in Supabase `profiles` table
- `shouldShowPaywall()` checks: Apple IAP status → Supabase profile → show paywall if both expired

**IAP Integration:**
- Product IDs defined in `subscriptionService.ts`: `PRODUCT_IDS`
- IAP initialized on app start in `app/_layout.tsx`
- Purchase flow: User purchases → Apple processes → `updateSupabaseSubscription()` syncs to Supabase
- Restore purchases available for reinstalls/device switches

**Important**: `react-native-iap` won't work in simulator. Use TestFlight for testing.

### Design System

All design tokens centralized in `constants/Design.ts`:
- Colors: Primary (Indigo #6366F1), Accent (Emerald #10B981), purpose-specific colors
- Spacing: 4px base unit (xs, sm, md, lg, xl, xxl)
- Typography: Font sizes and weights
- Border Radius: sm (8px), md (12px), lg (16px), xl (24px)
- Shadows: 4 levels for elevation

**Usage:**
```typescript
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/Design';

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  }
});
```

See `DESIGN_SYSTEM.md` for complete documentation.

### Database Schema

**Supabase Tables:**
- `profiles`: User profiles with trial/subscription info
- `trips`: All user trips (soft delete via `is_deleted`)
- `mileage_rates`: IRS standard mileage rates by year
- `vehicles`: User vehicles (if implemented)

**SQLite Tables** (legacy, being phased out):
- `trips`: Local trip cache
- `mileage_rates`: Local rate cache
- `schema_version`: Migration tracking

**Migrations:**
- SQLite: Version-based migrations in `database.ts`
- Supabase: Managed via Supabase dashboard/SQL editor

### Location Tracking

**Foreground Tracking:**
- Request permissions via `locationService.ts`
- Start tracking with `Location.watchPositionAsync()`
- Calculate distance using Haversine formula

**Background Tracking:**
- Requires `NSLocationAlwaysAndWhenInUseUsageDescription` (iOS)
- Configured in `app.json` with `UIBackgroundModes: ["location"]`
- Implemented in `backgroundTracking.ts` using `expo-task-manager`
- Automatically saves trips when tracking stops

## Common Development Patterns

### Creating a New Trip
```typescript
import { createTrip } from '@/services/tripService';

const trip = await createTrip({
  start_location: 'Home',
  end_location: 'Office',
  start_latitude: 37.7749,
  start_longitude: -122.4194,
  end_latitude: 37.7849,
  end_longitude: -122.4094,
  distance: 5.2,
  start_time: Date.now() - 3600000,
  end_time: Date.now(),
  purpose: 'business',
  notes: 'Client meeting',
});
```

### Checking Subscription Status
```typescript
import { shouldShowPaywall } from '@/services/subscriptionService';

const showPaywall = await shouldShowPaywall();
if (showPaywall) {
  router.push('/subscription/paywall');
}
```

### Using AuthContext
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) return <ActivityIndicator />;
  if (!user) return <Text>Not logged in</Text>;

  return <Text>Welcome {user.email}</Text>;
}
```

### Syncing Data
```typescript
import { syncTrips } from '@/services/syncService';

// Manual sync
const { uploaded, downloaded } = await syncTrips();

// Auto-sync happens on login via AuthContext
```

## Important Considerations

### Data Consistency
- Always use `tripService.ts` for new code (Supabase-first)
- Legacy `database.ts` SQLite code exists but should be avoided
- Sync service handles reconciliation between local and cloud

### Error Handling
- All service functions have try-catch with console.error
- Trip validation in `tripService.ts` throws errors for invalid data
- Network errors fail gracefully (offline mode supported via local SQLite)

### Performance
- Use pagination for large trip lists (not currently implemented)
- Background sync prevents blocking UI
- Local SQLite cache for instant load times

### Security
- Auth tokens stored in expo-secure-store
- Supabase RLS policies enforce user isolation (verify in Supabase dashboard)
- Apple IAP receipts should be verified server-side in production (currently client-side)

### Testing IAP
- Cannot test in iOS simulator (IAP not supported)
- Use TestFlight builds with sandbox Apple ID
- See `APPLE_IAP_SETUP_GUIDE.md` and `TESTFLIGHT.md` for detailed setup

## Environment Variables

Required in `.env` (create from `.env.example` if exists):
```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Key Files Reference

- `app/_layout.tsx` - Root navigator with auth/onboarding/subscription routing logic
- `contexts/AuthContext.tsx` - Global auth state
- `services/tripService.ts` - Primary trip data layer (Supabase)
- `services/subscriptionService.ts` - Apple IAP integration
- `services/syncService.ts` - Cloud sync logic
- `constants/Design.ts` - Design system tokens
- `app.json` - Expo configuration (bundle ID, permissions, plugins)
- `eas.json` - EAS Build configuration

## Related Documentation

- `DESIGN_SYSTEM.md` - Complete design token reference
- `APPLE_IAP_SETUP_GUIDE.md` - Setting up Apple In-App Purchases
- `REVENUECAT_SETUP_GUIDE.md` - Alternative subscription backend (if needed)
- `SETUP_GUIDE.md` - Initial project setup
- `TESTFLIGHT.md` - TestFlight deployment guide
- `ONBOARDING.md` - Onboarding flow documentation
- `SUBSCRIPTION_COMPLETE.md` - Subscription implementation notes
