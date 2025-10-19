# Onboarding Flow Documentation

## Overview

Your mileage tracker app now includes a comprehensive onboarding flow that guides new users through setting up their first vehicle. The onboarding process helps users:

1. Understand the app's features
2. Set up their vehicle profile
3. Pair their car's Bluetooth (optional)
4. Enter their current odometer reading
5. Start tracking immediately

## User Flow

### Step 1: Welcome Screen
- Shows app name and key features
- Lists benefits: automatic tracking, GPS calculation, tax exports, Bluetooth pairing
- "Get Started" button to begin setup

### Step 2: Vehicle Details
- **Required**: Vehicle name (e.g., "My Honda", "Work Truck")
- **Optional**: Make, Model, Year
- User-friendly input with clear labels
- Back/Next navigation

### Step 3: Bluetooth Pairing
- Instructions for pairing with car Bluetooth
- "Scan for Devices" button triggers 10-second scan
- Shows list of discovered Bluetooth devices
- User taps to select their car
- "Skip for Now" option to set up later
- Can return to Settings to pair later

### Step 4: Mileage Entry
- Enter current odometer reading
- Large, easy-to-read input field
- Helpful tip explaining where to find odometer
- Validates that mileage is a positive number

### Step 5: Completion
- Success message with checkmark
- Briefly shows before navigating to main app
- Vehicle is automatically set as active

## Implementation Details

### Files Created

1. **services/vehicleService.ts** - Vehicle profile management
   - Store multiple vehicles
   - Track initial and current mileage
   - Link Bluetooth devices to vehicles
   - Manage active vehicle selection

2. **services/onboardingService.ts** - Onboarding state management
   - Check if onboarding is completed
   - Mark onboarding as complete
   - Support for versioned onboarding (re-show for new features)

3. **app/onboarding/index.tsx** - Main onboarding screen
   - Multi-step wizard UI
   - Form validation
   - Bluetooth scanning
   - Mileage input

### Files Modified

1. **app/_layout.tsx**
   - Added onboarding route
   - Checks onboarding completion on app start
   - Redirects to onboarding if not completed
   - Prevents returning to onboarding after completion

2. **app/(tabs)/stats.tsx**
   - Added vehicle mileage display
   - Shows current odometer, starting odometer, and miles tracked
   - Automatically updates as trips are completed

3. **services/tripService.ts**
   - Updated to use vehicle service
   - Automatically updates vehicle mileage when trip is created
   - Gracefully handles missing vehicle (doesn't break trip creation)

## Vehicle Service Features

### Data Structure

```typescript
interface Vehicle {
  id: string;                    // Unique identifier
  name: string;                  // User-friendly name
  make?: string;                 // Optional make (Honda, Toyota, etc.)
  model?: string;                // Optional model (Accord, Camry, etc.)
  year?: string;                 // Optional year
  initialMileage: number;        // Odometer reading at setup
  currentMileage: number;        // Current odometer (auto-updated)
  bluetoothDeviceId?: string;    // Paired Bluetooth device ID
  bluetoothDeviceName?: string;  // Paired Bluetooth device name
  dateAdded: number;             // Timestamp when added
  lastUpdated: number;           // Last update timestamp
}
```

### Key Functions

- `getAllVehicles()` - Get all user vehicles
- `getActiveVehicle()` - Get the currently selected vehicle
- `setActiveVehicle(id)` - Switch active vehicle
- `createVehicle()` - Add new vehicle
- `updateVehicle()` - Update vehicle details
- `deleteVehicle()` - Remove vehicle
- `updateVehicleMileage()` - Add miles to vehicle (auto-called on trip completion)
- `getVehicleByBluetoothDevice()` - Find vehicle by Bluetooth device
- `getTotalMilesDriven()` - Total miles across all vehicles

## Mileage Tracking

### How It Works

1. User enters initial odometer reading during onboarding
2. Each trip automatically updates the vehicle's `currentMileage`
3. Stats screen shows:
   - Current odometer reading
   - Starting odometer reading (from onboarding)
   - Total miles tracked by the app

### Example

```
Initial Mileage: 50,000 miles (entered during onboarding)
Trip 1: 10.5 miles → Current Mileage: 50,010.5 miles
Trip 2: 25.3 miles → Current Mileage: 50,035.8 miles
Trip 3: 5.2 miles  → Current Mileage: 50,041.0 miles

Miles Tracked: 41.0 miles (50,041.0 - 50,000)
```

## Onboarding Behavior

### First Launch
- User opens app for the first time
- Automatically redirected to `/onboarding`
- Must complete onboarding to access main app

### Subsequent Launches
- Onboarding completion is checked
- User goes directly to `/(tabs)` (main app)
- Cannot return to onboarding flow

### Re-showing Onboarding
For testing or when adding new onboarding features:

```typescript
import { resetOnboarding } from '@/services/onboardingService';

// Reset onboarding state
await resetOnboarding();

// Next app launch will show onboarding again
```

### Versioned Onboarding
The onboarding service supports versioning:

```typescript
// In onboardingService.ts
const CURRENT_ONBOARDING_VERSION = 1;

// Increment this when you want to re-show onboarding
// e.g., to introduce new features
```

## UI/UX Highlights

### Design Principles
- Clean, simple interface
- Clear progress through steps
- Optional vs. required fields clearly marked
- Helpful tips and instructions
- Easy navigation (Back/Next/Skip)
- Visual feedback (icons, colors, animations)

### User-Friendly Features
- Large touch targets for mobile
- Keyboard types match input (numeric for year/mileage)
- Input validation with helpful error messages
- Loading indicators for async operations
- Success confirmation before entering app

### Accessibility
- Clear labels for all inputs
- Descriptive button text
- High contrast colors
- Sufficient touch target sizes

## Integration with Existing Features

### Auto-Tracking
- Onboarding doesn't enable auto-tracking
- User can enable in Settings after onboarding
- Bluetooth pairing from onboarding is used for Bluetooth trigger mode

### Settings
- User can add additional vehicles in Settings (future feature)
- Bluetooth devices can be paired later if skipped
- Vehicle details can be edited in Settings (future feature)

### Stats
- Vehicle mileage displayed prominently
- Shows tracking history from initial setup
- Updates in real-time as trips are completed

## Testing the Onboarding Flow

### Test Checklist

- [ ] First launch shows onboarding
- [ ] Welcome screen displays correctly
- [ ] Can enter vehicle name (required)
- [ ] Can enter make/model/year (optional)
- [ ] Can scan for Bluetooth devices
- [ ] Can select Bluetooth device
- [ ] Can skip Bluetooth pairing
- [ ] Can enter initial mileage
- [ ] Mileage validation works (rejects negative/invalid)
- [ ] Completion screen shows briefly
- [ ] App navigates to main tabs after completion
- [ ] Second launch skips onboarding
- [ ] Vehicle appears in stats screen
- [ ] Trip completion updates vehicle mileage
- [ ] Back button navigation works
- [ ] Input validation shows errors

### Manual Testing Steps

1. **Reset onboarding** (if testing again):
   ```typescript
   import { resetOnboarding } from '@/services/onboardingService';
   await resetOnboarding();
   ```

2. **Test happy path**:
   - Enter vehicle name: "Test Car"
   - Enter make: "Honda"
   - Enter model: "Accord"
   - Enter year: "2020"
   - Skip Bluetooth (or test pairing if near car)
   - Enter mileage: "50000"
   - Verify completion and navigation

3. **Test validation**:
   - Try to skip vehicle name (should show error)
   - Try entering negative mileage (should show error)
   - Try entering invalid year (should show error)

4. **Test Bluetooth**:
   - Tap "Scan for Devices" while near car
   - Verify devices appear
   - Select car from list
   - Verify selection is shown
   - Complete onboarding
   - Check Settings to see paired device

5. **Test persistence**:
   - Complete onboarding
   - Close and reopen app
   - Verify goes to main app (not onboarding)
   - Go to Stats
   - Verify vehicle info is displayed

6. **Test mileage tracking**:
   - Complete onboarding with initial mileage 50000
   - Create a test trip of 10 miles
   - Go to Stats
   - Verify current mileage shows 50010

## Future Enhancements

Possible improvements:

1. **Multiple Vehicles**
   - Add vehicles from Settings
   - Switch between vehicles
   - Per-vehicle trip history

2. **Edit Vehicle**
   - Update vehicle details
   - Change vehicle name/make/model
   - Update odometer if needed (with warning)

3. **Vehicle Photos**
   - Add photo of vehicle
   - Display in vehicle card

4. **Maintenance Tracking**
   - Link maintenance to vehicle
   - Mileage-based reminders

5. **Odometer Validation**
   - Warn if odometer seems incorrect
   - Suggest corrections based on trip totals

6. **Import Existing Data**
   - Skip onboarding if user has backup
   - Restore vehicles from backup

7. **Progress Indicator**
   - Show step numbers (1/4, 2/4, etc.)
   - Progress bar at top

8. **Animations**
   - Slide transitions between steps
   - Fade in/out effects
   - Loading animations

## Troubleshooting

### Onboarding doesn't appear on first launch
- Check that `isOnboardingCompleted()` returns `false`
- Verify AsyncStorage is working
- Check console for navigation errors

### Can't skip onboarding
- Verify all required fields are filled
- Check validation logic
- Ensure navigation is not blocked

### Bluetooth scan returns no devices
- Check Bluetooth permissions
- Verify Bluetooth is enabled on device
- Ensure car Bluetooth is on and visible
- Check console for scanning errors

### Vehicle mileage not updating
- Verify trips are being created successfully
- Check `updateVehicleMileage()` is called in `createTrip()`
- Check console for vehicle service errors
- Verify active vehicle exists

### Stats screen doesn't show vehicle
- Verify vehicle was created during onboarding
- Check `getActiveVehicle()` returns a vehicle
- Verify vehicle service AsyncStorage key

## Developer Notes

### State Management
- Onboarding state stored in AsyncStorage
- Vehicle data stored in AsyncStorage
- No Redux or complex state management needed

### Navigation
- Uses expo-router for navigation
- Layout component handles onboarding check
- Automatic redirects based on completion state

### Data Flow
1. User completes onboarding
2. `createVehicle()` saves to AsyncStorage
3. `completeOnboarding()` marks onboarding done
4. App navigates to main tabs
5. Stats screen loads vehicle data
6. Trips update vehicle mileage on creation

### AsyncStorage Keys
- `onboarding_completed` - Boolean completion flag
- `onboarding_version` - Version number
- `vehicles` - Array of vehicles
- `active_vehicle_id` - ID of current vehicle

### Error Handling
- Validation errors shown to user
- Network/Bluetooth errors handled gracefully
- Vehicle service errors don't break trip creation
- Fallback to no vehicle if vehicle service fails

## Summary

The onboarding flow provides a smooth first-run experience that:
- Educates users about app features
- Collects essential vehicle information
- Sets up Bluetooth pairing (optional)
- Establishes baseline odometer reading
- Prepares app for immediate use

The implementation is clean, maintainable, and extensible for future enhancements like multiple vehicles and advanced vehicle management features.
