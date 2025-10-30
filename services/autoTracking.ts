import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startBackgroundTracking, stopBackgroundTracking, clearActiveTrip, isTrackingActive } from './backgroundTracking';
import { reverseGeocode, getCurrentLocation, calculateDistance } from './locationService';
import { createTrip } from './tripService';
import { sendTripCompletedNotification } from './notificationService';

const AUTO_TRACKING_TASK = 'auto-tracking-monitor';
const AUTO_TRACKING_ENABLED_KEY = 'auto_tracking_enabled';
const AUTO_TRACKING_PURPOSE_KEY = 'auto_tracking_default_purpose';
const DRIVING_SPEED_THRESHOLD = 5; // mph - minimum speed to consider driving
const STATIONARY_DURATION = 180000; // 3 minutes - how long stopped before ending trip
const MIN_TRIP_DISTANCE = 0; // miles - save all trips regardless of distance
const LOCATION_BUFFER_SIZE = 20; // Keep last 20 locations (~1 minute of history at 3s intervals)
const LOOKBACK_MOVEMENT_THRESHOLD = 0.01; // miles - minimum movement to consider as trip start
const MIN_TIME_DELTA = 2000; // 2 seconds - minimum time between locations for valid speed calculation
const MAX_SPEED_MPH = 200; // Cap speed at 200 mph (prevents absurd calculations from GPS errors)

interface LocationState {
  lastSpeed: number;
  lastMovementTime: number;
  stoppedSince: number | null;
  drivingDetected: boolean;
}

interface BufferedLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed: number;
}

let locationState: LocationState = {
  lastSpeed: 0,
  lastMovementTime: Date.now(),
  stoppedSince: null,
  drivingDetected: false,
};

// Store last location for speed calculation
let lastLocationForSpeed: { latitude: number; longitude: number; timestamp: number } | null = null;

// Rolling buffer of recent locations (for looking back when trip starts)
let locationBuffer: BufferedLocation[] = [];

// Define the auto-tracking monitoring task
TaskManager.defineTask(AUTO_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Auto-tracking task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (!location || !location.coords) {
      console.log('[AutoTracking] No location data received');
      return;
    }

    try {
      const enabled = await isAutoTrackingEnabled();
      if (!enabled) {
        console.log('[AutoTracking] Auto-tracking is disabled, skipping location update');
        return;
      }

      const isTracking = await isTrackingActive();

      // Calculate speed - use device speed if available, otherwise calculate manually
      let speed = 0;
      const deviceSpeed = location.coords.speed || 0;

      if (deviceSpeed > 0) {
        // Device provided speed (in m/s)
        speed = deviceSpeed * 2.23694; // Convert m/s to mph
        // Cap speed at reasonable maximum to prevent GPS errors
        speed = Math.min(speed, MAX_SPEED_MPH);
        console.log(`[AutoTracking] Device speed: ${speed.toFixed(1)} mph`);
      } else if (lastLocationForSpeed) {
        // Calculate speed manually from last location
        const { latitude: lastLat, longitude: lastLon, timestamp: lastTime } = lastLocationForSpeed;
        const { latitude, longitude } = location.coords;
        const timeDiff = Date.now() - lastTime; // milliseconds

        // Only calculate speed if enough time has passed (prevents division by near-zero)
        if (timeDiff >= MIN_TIME_DELTA) {
          const distance = calculateDistance(lastLat, lastLon, latitude, longitude); // miles
          const hours = timeDiff / (1000 * 60 * 60); // convert ms to hours
          const rawSpeed = distance / hours; // mph

          // Cap speed at reasonable maximum to prevent GPS errors from creating absurd values
          speed = Math.min(rawSpeed, MAX_SPEED_MPH);

          console.log(`[AutoTracking] Calculated speed: ${speed.toFixed(1)} mph (${distance.toFixed(4)} mi in ${(timeDiff/1000).toFixed(1)}s)`);

          // Warn if speed seems unrealistic (but still use capped value)
          if (rawSpeed > MAX_SPEED_MPH) {
            console.warn(`[AutoTracking] ⚠️ GPS error detected: calculated speed ${rawSpeed.toFixed(1)} mph exceeds maximum, capped at ${MAX_SPEED_MPH} mph`);
          }
        } else {
          console.log(`[AutoTracking] Time delta too small (${timeDiff}ms < ${MIN_TIME_DELTA}ms), skipping speed calculation`);
        }
      }

      const now = Date.now();

      // Add location to rolling buffer (for lookback when trip starts)
      locationBuffer.push({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: now,
        speed: speed,
      });

      // Keep buffer size limited
      if (locationBuffer.length > LOCATION_BUFFER_SIZE) {
        locationBuffer.shift(); // Remove oldest location
      }

      // Update last location for next speed calculation
      lastLocationForSpeed = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: now,
      };

      console.log(`[AutoTracking] Location update: speed=${speed.toFixed(1)} mph, tracking=${isTracking}, buffer=${locationBuffer.length} locations`);

      // Update location state
      locationState.lastSpeed = speed;

      // Detect if driving (speed above threshold)
      const isDriving = speed >= DRIVING_SPEED_THRESHOLD;

      if (isDriving) {
        // Only reset stop timer if we were previously stopped
        if (locationState.stoppedSince !== null) {
          console.log(`[AutoTracking] ⚠️ Movement detected (${speed.toFixed(1)} mph) - resetting stop timer`);
        }
        locationState.lastMovementTime = now;
        locationState.stoppedSince = null;

        // Start tracking if not already tracking
        if (!isTracking && !locationState.drivingDetected) {
          console.log(`[AutoTracking] Driving detected at ${speed.toFixed(1)} mph, starting trip...`);
          locationState.drivingDetected = true;
          await autoStartTrip(location);
        }
      } else {
        // Stopped or moving slowly
        if (isTracking) {
          // Mark when we first stopped
          if (locationState.stoppedSince === null) {
            locationState.stoppedSince = now;
            console.log(`[AutoTracking] 🛑 Vehicle stopped at ${speed.toFixed(1)} mph, waiting ${STATIONARY_DURATION / 1000}s before ending trip...`);
          } else {
            // Log progress toward completion
            const stoppedDuration = now - locationState.stoppedSince;
            const remainingTime = STATIONARY_DURATION - stoppedDuration;
            console.log(`[AutoTracking] Still stopped (${speed.toFixed(1)} mph) - ${(stoppedDuration / 1000).toFixed(0)}s elapsed, ${(remainingTime / 1000).toFixed(0)}s until auto-save`);
          }

          // Check if stopped long enough to end trip
          const stoppedDuration = now - locationState.stoppedSince;
          if (stoppedDuration >= STATIONARY_DURATION) {
            console.log(`[AutoTracking] ✅ Vehicle stationary for ${(stoppedDuration / 1000).toFixed(0)}s, ending trip...`);
            await autoStopTrip();
            locationState.drivingDetected = false;
            locationState.stoppedSince = null;
          }
        } else if (locationState.drivingDetected && !isTracking) {
          // Reset driving detected flag if tracking somehow stopped without us knowing
          console.log('[AutoTracking] Resetting driving detected flag - tracking stopped unexpectedly');
          locationState.drivingDetected = false;
          locationState.stoppedSince = null;
        }
      }
    } catch (err) {
      console.error('Error in auto-tracking task:', err);
    }
  }
});

/**
 * Look back through location buffer to find where trip actually started
 * This helps capture the beginning of a trip that wasn't immediately detected
 */
function findTripStartLocation(currentLocation: Location.LocationObject): BufferedLocation {
  if (locationBuffer.length < 2) {
    // Not enough history, use current location
    return {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
      timestamp: Date.now(),
      speed: currentLocation.coords.speed ? currentLocation.coords.speed * 2.23694 : 0,
    };
  }

  // Start from the oldest buffered location and find where significant movement began
  // We look for the first location where the vehicle started moving from a stationary position
  let tripStartIndex = 0;
  let firstStationaryLocation = locationBuffer[0];

  for (let i = 1; i < locationBuffer.length; i++) {
    const prev = locationBuffer[i - 1];
    const curr = locationBuffer[i];
    const distance = calculateDistance(prev.latitude, prev.longitude, curr.latitude, curr.longitude);

    // If we find significant movement (more than threshold), this is likely where the trip started
    if (distance >= LOOKBACK_MOVEMENT_THRESHOLD) {
      tripStartIndex = i - 1; // Use the location just before movement began
      firstStationaryLocation = prev;
      console.log(`[AutoTracking] 📍 Found trip start ${i - 1} locations back (${distance.toFixed(3)} mi movement detected)`);
      break;
    }
  }

  const startLocation = locationBuffer[tripStartIndex];
  const distanceRecovered = calculateDistance(
    startLocation.latitude,
    startLocation.longitude,
    currentLocation.coords.latitude,
    currentLocation.coords.longitude
  );

  console.log(`[AutoTracking] 🔍 Lookback analysis: recovered ${distanceRecovered.toFixed(2)} miles from before detection`);
  console.log(`[AutoTracking] Trip will start from ${(Date.now() - startLocation.timestamp) / 1000}s ago`);

  return startLocation;
}

async function autoStartTrip(location: Location.LocationObject) {
  try {
    // Look back through location buffer to find actual trip start
    const actualStartLocation = findTripStartLocation(location);

    const { latitude, longitude } = actualStartLocation;
    const address = await reverseGeocode(latitude, longitude);
    const purpose = await getDefaultPurpose();

    console.log(`[AutoTracking] 🚗 Starting new trip from: ${address}`);
    console.log(`[AutoTracking] Purpose: ${purpose}, Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);

    const started = await startBackgroundTracking(
      address,
      latitude,
      longitude,
      purpose,
      'Auto-tracked trip'
    );

    if (started) {
      console.log(`[AutoTracking] ✅ Trip started successfully from: ${address}`);
      // Clear buffer now that we've used it to start the trip
      locationBuffer = [];
      console.log('[AutoTracking] Location buffer cleared for new trip');
      // Could send a notification here
    } else {
      console.log('[AutoTracking] ❌ Failed to start trip - check permissions');
    }
  } catch (error) {
    console.error('[AutoTracking] Error auto-starting trip:', error);
  }
}

async function autoStopTrip() {
  try {
    const completedTrip = await stopBackgroundTracking();

    if (!completedTrip) {
      console.log('[AutoTracking] No active trip to stop');
      return;
    }

    console.log(`[AutoTracking] Trip completed - Distance: ${completedTrip.distance.toFixed(2)} miles`);

    if (completedTrip.distance >= MIN_TRIP_DISTANCE) {
      console.log('[AutoTracking] Trip meets minimum distance, saving...');

      // Get end location
      const location = await getCurrentLocation();
      let endLocation = 'Unknown';
      let endLat = completedTrip.last_latitude;
      let endLon = completedTrip.last_longitude;

      if (location) {
        endLocation = await reverseGeocode(location.latitude, location.longitude);
        endLat = location.latitude;
        endLon = location.longitude;
      }

      // Save trip directly to database
      const now = Date.now();
      const tripData = {
        start_location: completedTrip.start_location,
        end_location: endLocation,
        start_latitude: completedTrip.start_latitude,
        start_longitude: completedTrip.start_longitude,
        end_latitude: endLat,
        end_longitude: endLon,
        distance: completedTrip.distance,
        start_time: completedTrip.start_time,
        end_time: now,
        purpose: completedTrip.purpose,
        notes: completedTrip.notes,
      };

      console.log('[AutoTracking] Saving trip data:', {
        distance: tripData.distance,
        from: tripData.start_location,
        to: tripData.end_location,
        purpose: tripData.purpose,
      });

      try {
        const savedTrip = await createTrip(tripData);

        // Clear trip data after successful save
        await clearActiveTrip();

        console.log(`[AutoTracking] ✅ Trip saved successfully with ID: ${savedTrip.id}`);
        console.log(`[AutoTracking] Trip details: ${tripData.distance.toFixed(2)} miles from ${tripData.start_location} to ${tripData.end_location}`);

        // Send notification about completed trip
        try {
          await sendTripCompletedNotification(savedTrip);
          console.log('[AutoTracking] 🔔 Trip completion notification sent');
        } catch (notifError) {
          console.error('[AutoTracking] Error sending notification:', notifError);
        }
      } catch (error: any) {
        // Check if trip was queued for offline upload
        if (error.queued) {
          console.log('[AutoTracking] ⏱️ Trip queued for upload when connection available');
          // Trip queued successfully - clear active trip so user can start new ones
          await clearActiveTrip();
          console.log('[AutoTracking] ✅ Active trip cleared - trip will sync automatically');
        } else {
          // Real error - keep trip in AsyncStorage for manual recovery
          console.error('[AutoTracking] ❌ Failed to save trip:', error.message);
          throw error;
        }
      }
    } else {
      console.log(`[AutoTracking] ❌ Trip too short (${completedTrip.distance.toFixed(2)} miles < ${MIN_TRIP_DISTANCE} miles minimum), discarding`);
      // Clear trip data even if too short
      await clearActiveTrip();
    }
  } catch (error) {
    console.error('[AutoTracking] ❌ Error auto-stopping trip:', error);
    if (error instanceof Error) {
      console.error('[AutoTracking] Error details:', error.message);
      console.error('[AutoTracking] Stack trace:', error.stack);
    }
  }
}

export async function startAutoTracking(): Promise<boolean> {
  try {
    // Request permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      return false;
    }

    // Start location monitoring
    console.log('[AutoTracking] Starting auto-tracking location updates...');
    await Location.startLocationUpdatesAsync(AUTO_TRACKING_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 3000, // Check every 3 seconds for faster trip detection
      distanceInterval: 20, // Get updates every ~20 meters (~0.012 miles) when moving
      foregroundService: {
        notificationTitle: 'Auto Tracking Active',
        notificationBody: 'Mileage Tracker will automatically detect your trips',
        notificationColor: '#34C759',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    await AsyncStorage.setItem(AUTO_TRACKING_ENABLED_KEY, 'true');
    console.log('[AutoTracking] ✅ Auto-tracking started successfully');
    console.log('[AutoTracking] Configuration: High accuracy, 3s time interval, 20m distance interval');
    return true;
  } catch (error) {
    console.error('Error starting auto-tracking:', error);
    return false;
  }
}

export async function stopAutoTracking(): Promise<void> {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(AUTO_TRACKING_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(AUTO_TRACKING_TASK);
    }

    // Also stop and SAVE any active trip before disabling auto-tracking
    const isTracking = await isTrackingActive();
    if (isTracking) {
      console.log('[AutoTracking] Stopping auto-tracking with active trip - auto-completing trip first...');
      await autoStopTrip(); // This will save the trip and then clear it
    }

    await AsyncStorage.setItem(AUTO_TRACKING_ENABLED_KEY, 'false');
    locationState = {
      lastSpeed: 0,
      lastMovementTime: Date.now(),
      stoppedSince: null,
      drivingDetected: false,
    };
    locationBuffer = []; // Clear location history
    lastLocationForSpeed = null;
  } catch (error) {
    console.error('Error stopping auto-tracking:', error);
  }
}

export async function isAutoTrackingEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(AUTO_TRACKING_ENABLED_KEY);
    return enabled === 'true';
  } catch {
    return false;
  }
}

export async function isAutoTrackingActive(): Promise<boolean> {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(AUTO_TRACKING_TASK);
    return hasStarted;
  } catch {
    return false;
  }
}

export async function setDefaultPurpose(
  purpose: 'business' | 'personal' | 'medical' | 'charity' | 'other'
): Promise<void> {
  await AsyncStorage.setItem(AUTO_TRACKING_PURPOSE_KEY, purpose);
}

export async function getDefaultPurpose(): Promise<
  'business' | 'personal' | 'medical' | 'charity' | 'other'
> {
  const purpose = await AsyncStorage.getItem(AUTO_TRACKING_PURPOSE_KEY);
  return (purpose as any) || 'business';
}
