import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateDistance } from './locationService';
import { saveActiveTripProgress } from './localDatabase';
import { getCurrentUserId } from './authService';

const LOCATION_TASK_NAME = 'background-location-task';
const ACTIVE_TRIP_KEY = 'active_trip';

export interface ActiveTrip {
  id: string;
  start_location: string;
  start_latitude: number;
  start_longitude: number;
  start_time: number;
  purpose: 'business' | 'personal' | 'medical' | 'charity' | 'other';
  notes?: string;
  distance: number;
  location_points: {
    latitude: number;
    longitude: number;
    timestamp: number;
  }[];
  last_latitude: number;
  last_longitude: number;
}

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundTracking] ❌ Background location task error:', error);
    // Don't return - try to continue if possible
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };

    try {
      // Get the active trip from storage
      const activeTripJson = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
      if (!activeTripJson) {
        return;
      }

      const activeTrip: ActiveTrip = JSON.parse(activeTripJson);
      const location = locations[0];

      if (location && location.coords) {
        const { latitude, longitude } = location.coords;

        // Calculate distance from last point
        const distanceFromLast = calculateDistance(
          activeTrip.last_latitude,
          activeTrip.last_longitude,
          latitude,
          longitude
        );

        // Only update if moved at least 10 meters (0.006 miles)
        if (distanceFromLast > 0.006) {
          activeTrip.distance += distanceFromLast;
          activeTrip.last_latitude = latitude;
          activeTrip.last_longitude = longitude;
          activeTrip.location_points.push({
            latitude,
            longitude,
            timestamp: Date.now(),
          });

          // Save to AsyncStorage (cache for quick reads)
          try {
            await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(activeTrip));
          } catch (asyncError) {
            console.error('[BackgroundTracking] ⚠️ AsyncStorage write failed (non-critical):', asyncError);
            // Continue anyway - SQLite is the source of truth
          }

          // Save to SQLite with retry logic (crash-safe persistence)
          const userId = await getCurrentUserId();
          if (userId) {
            let retries = 3;
            let saved = false;

            while (retries > 0 && !saved) {
              try {
                await saveActiveTripProgress(activeTrip.id, userId, {
                  start_location: activeTrip.start_location,
                  start_latitude: activeTrip.start_latitude,
                  start_longitude: activeTrip.start_longitude,
                  start_time: activeTrip.start_time,
                  purpose: activeTrip.purpose,
                  notes: activeTrip.notes || '',
                  distance: activeTrip.distance,
                  last_latitude: activeTrip.last_latitude,
                  last_longitude: activeTrip.last_longitude,
                });
                saved = true;
                console.log(`[BackgroundTracking] ✅ Trip progress saved to SQLite: ${activeTrip.distance.toFixed(2)} mi`);
              } catch (sqliteError) {
                retries--;
                console.error(`[BackgroundTracking] ❌ SQLite save failed (${retries} retries left):`, sqliteError);

                if (retries > 0) {
                  // Wait briefly before retrying
                  await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                  // All retries failed - log critical error
                  console.error('[BackgroundTracking] 🔥 CRITICAL: All save attempts failed. Trip data may be at risk!');
                  // Note: Data still in AsyncStorage, can be recovered on next app launch
                }
              }
            }
          } else {
            console.error('[BackgroundTracking] ⚠️ No user ID found - cannot save to SQLite');
          }
        }
      }
    } catch (err) {
      console.error('[BackgroundTracking] ❌ Error processing location update:', err);
      // Log the error but don't crash - continue tracking
    }
  }
});

export async function startBackgroundTracking(
  startLocation: string,
  startLatitude: number,
  startLongitude: number,
  purpose: 'business' | 'personal' | 'medical' | 'charity' | 'other',
  notes?: string
): Promise<boolean> {
  try {
    // Request background location permission
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      return false;
    }

    // Create active trip
    const activeTrip: ActiveTrip = {
      id: Date.now().toString(),
      start_location: startLocation,
      start_latitude: startLatitude,
      start_longitude: startLongitude,
      start_time: Date.now(),
      purpose,
      notes,
      distance: 0,
      location_points: [
        {
          latitude: startLatitude,
          longitude: startLongitude,
          timestamp: Date.now(),
        },
      ],
      last_latitude: startLatitude,
      last_longitude: startLongitude,
    };

    // Save to AsyncStorage (cache)
    await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(activeTrip));

    // Save initial trip to SQLite for crash safety
    const userId = await getCurrentUserId();
    if (userId) {
      try {
        await saveActiveTripProgress(activeTrip.id, userId, {
          start_location: activeTrip.start_location,
          start_latitude: activeTrip.start_latitude,
          start_longitude: activeTrip.start_longitude,
          start_time: activeTrip.start_time,
          purpose: activeTrip.purpose,
          notes: activeTrip.notes || '',
          distance: 0,
          last_latitude: activeTrip.last_latitude,
          last_longitude: activeTrip.last_longitude,
        });
        console.log('[BackgroundTracking] ✅ Initial trip saved to SQLite');
      } catch (sqliteError) {
        console.error('[BackgroundTracking] ⚠️ Failed to save initial trip to SQLite:', sqliteError);
        // Continue anyway - will retry on first location update
      }
    }

    // Start background location updates
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000, // Update every 5 seconds
      distanceInterval: 10, // Update every 10 meters
      foregroundService: {
        notificationTitle: 'Tracking Trip',
        notificationBody: 'Mileage Tracker is recording your trip',
        notificationColor: '#007AFF',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });

    return true;
  } catch (error) {
    console.error('Error starting background tracking:', error);
    return false;
  }
}

export async function stopBackgroundTracking(): Promise<ActiveTrip | null> {
  try {
    // Stop location updates
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    // Get active trip but DON'T clear it yet
    // Data will be cleared after successful save to prevent data loss
    const activeTripJson = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
    if (activeTripJson) {
      return JSON.parse(activeTripJson);
    }

    return null;
  } catch (error) {
    console.error('Error stopping background tracking:', error);
    return null;
  }
}

/**
 * Clear the active trip from storage
 * Call this ONLY after successfully saving the trip to database
 */
export async function clearActiveTrip(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
  } catch (error) {
    console.error('Error clearing active trip:', error);
  }
}

export async function getActiveTrip(): Promise<ActiveTrip | null> {
  try {
    const activeTripJson = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);

    if (activeTripJson) {
      const trip = JSON.parse(activeTripJson);

      // Check if trip is orphaned (tracking not active but trip exists)
      // This can happen if app crashed or tracking stopped unexpectedly
      const isActive = await isTrackingActive();
      const tripAge = Date.now() - trip.start_time;
      const oneHour = 60 * 60 * 1000;

      if (!isActive && tripAge > oneHour) {
        console.warn('[BackgroundTracking] Found orphaned trip older than 1 hour - trip may need recovery');
        console.warn(`[BackgroundTracking] Trip started at ${new Date(trip.start_time).toLocaleString()}, distance: ${trip.distance.toFixed(2)} miles`);
      }

      return trip;
    }

    return null;
  } catch (error) {
    console.error('Error getting active trip:', error);
    return null;
  }
}

export async function isTrackingActive(): Promise<boolean> {
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    return hasStarted;
  } catch {
    return false;
  }
}
