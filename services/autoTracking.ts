import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { startBackgroundTracking, stopBackgroundTracking, isTrackingActive } from './backgroundTracking';
import { reverseGeocode, getCurrentLocation } from './locationService';
import { createTrip } from './tripService';
import { sendTripCompletedNotification } from './notificationService';

const AUTO_TRACKING_TASK = 'auto-tracking-monitor';
const AUTO_TRACKING_ENABLED_KEY = 'auto_tracking_enabled';
const AUTO_TRACKING_PURPOSE_KEY = 'auto_tracking_default_purpose';
const DRIVING_SPEED_THRESHOLD = 5; // mph - minimum speed to consider driving
const STATIONARY_DURATION = 180000; // 3 minutes - how long stopped before ending trip
const MIN_TRIP_DISTANCE = 0; // miles - save all trips regardless of distance

interface LocationState {
  lastSpeed: number;
  lastMovementTime: number;
  stoppedSince: number | null;
  drivingDetected: boolean;
}

let locationState: LocationState = {
  lastSpeed: 0,
  lastMovementTime: Date.now(),
  stoppedSince: null,
  drivingDetected: false,
};

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
      return;
    }

    try {
      const enabled = await isAutoTrackingEnabled();
      if (!enabled) {
        return;
      }

      const isTracking = await isTrackingActive();
      const speed = (location.coords.speed || 0) * 2.23694; // m/s to mph
      const now = Date.now();

      // Update location state
      locationState.lastSpeed = speed;

      // Detect if driving (speed above threshold)
      const isDriving = speed >= DRIVING_SPEED_THRESHOLD;

      if (isDriving) {
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
            console.log(`[AutoTracking] Vehicle stopped at ${speed.toFixed(1)} mph, waiting ${STATIONARY_DURATION / 1000}s before ending trip...`);
          }

          // Check if stopped long enough to end trip
          const stoppedDuration = now - locationState.stoppedSince;
          if (stoppedDuration >= STATIONARY_DURATION) {
            console.log(`[AutoTracking] Vehicle stationary for ${stoppedDuration / 1000}s, ending trip...`);
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

async function autoStartTrip(location: Location.LocationObject) {
  try {
    const { latitude, longitude } = location.coords;
    const address = await reverseGeocode(latitude, longitude);
    const purpose = await getDefaultPurpose();

    console.log(`[AutoTracking] 🚗 Starting new trip from: ${address}`);
    console.log(`[AutoTracking] Purpose: ${purpose}, Location: ${latitude}, ${longitude}`);

    const started = await startBackgroundTracking(
      address,
      latitude,
      longitude,
      purpose,
      'Auto-tracked trip'
    );

    if (started) {
      console.log(`[AutoTracking] ✅ Trip started successfully from: ${address}`);
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
      let endLat = completedTrip.lastLatitude;
      let endLon = completedTrip.lastLongitude;

      if (location) {
        endLocation = await reverseGeocode(location.latitude, location.longitude);
        endLat = location.latitude;
        endLon = location.longitude;
      }

      // Save trip directly to database
      const now = Date.now();
      const tripData = {
        startLocation: completedTrip.startLocation,
        endLocation,
        startLatitude: completedTrip.startLatitude,
        startLongitude: completedTrip.startLongitude,
        endLatitude: endLat,
        endLongitude: endLon,
        distance: completedTrip.distance,
        startTime: completedTrip.startTime,
        endTime: now,
        purpose: completedTrip.purpose,
        notes: completedTrip.notes,
      };

      console.log('[AutoTracking] Saving trip data:', {
        distance: tripData.distance,
        from: tripData.startLocation,
        to: tripData.endLocation,
        purpose: tripData.purpose,
      });

      const tripId = await createTrip(tripData);

      console.log(`[AutoTracking] ✅ Trip saved successfully with ID: ${tripId}`);
      console.log(`[AutoTracking] Trip details: ${tripData.distance.toFixed(2)} miles from ${tripData.startLocation} to ${tripData.endLocation}`);

      // Send notification about completed trip
      try {
        const now = Date.now();
        await sendTripCompletedNotification({
          ...tripData,
          id: tripId,
          createdAt: now,
          updatedAt: now,
        });
        console.log('[AutoTracking] 🔔 Trip completion notification sent');
      } catch (notifError) {
        console.error('[AutoTracking] Error sending notification:', notifError);
      }
    } else {
      console.log(`[AutoTracking] ❌ Trip too short (${completedTrip.distance.toFixed(2)} miles < ${MIN_TRIP_DISTANCE} miles minimum), discarding`);
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
    await Location.startLocationUpdatesAsync(AUTO_TRACKING_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000, // Check every 10 seconds
      distanceInterval: 50, // Or every 50 meters
      foregroundService: {
        notificationTitle: 'Auto Tracking Active',
        notificationBody: 'Mileage Tracker will automatically detect your trips',
        notificationColor: '#34C759',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    await AsyncStorage.setItem(AUTO_TRACKING_ENABLED_KEY, 'true');
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

    // Also stop any active trip
    const isTracking = await isTrackingActive();
    if (isTracking) {
      await stopBackgroundTracking();
    }

    await AsyncStorage.setItem(AUTO_TRACKING_ENABLED_KEY, 'false');
    locationState = {
      lastSpeed: 0,
      lastMovementTime: Date.now(),
      stoppedSince: null,
      drivingDetected: false,
    };
  } catch (error) {
    console.error('Error stopping auto-tracking:', error);
  }
}

export async function isAutoTrackingEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(AUTO_TRACKING_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    return false;
  }
}

export async function isAutoTrackingActive(): Promise<boolean> {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(AUTO_TRACKING_TASK);
    return hasStarted;
  } catch (error) {
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
