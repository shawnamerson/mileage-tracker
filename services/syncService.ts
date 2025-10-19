import { supabase, CloudTrip } from './supabase';
import { getAllTrips, createTrip, updateTrip, deleteTrip } from './tripService';
import { Trip } from './database';
import { getCurrentUser } from './authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = 'last_sync_timestamp';

/**
 * Convert local trip to cloud format
 */
function tripToCloudTrip(trip: Trip, userId: string): Omit<CloudTrip, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    start_location: trip.startLocation,
    end_location: trip.endLocation,
    start_latitude: trip.startLatitude || 0,
    start_longitude: trip.startLongitude || 0,
    end_latitude: trip.endLatitude || 0,
    end_longitude: trip.endLongitude || 0,
    distance: trip.distance,
    start_time: trip.startTime,
    end_time: trip.endTime,
    purpose: trip.purpose,
    notes: trip.notes || '',
    is_deleted: false,
    deleted_at: null,
  };
}

/**
 * Convert cloud trip to local format
 */
function cloudTripToTrip(cloudTrip: CloudTrip): Omit<Trip, 'id'> {
  return {
    startLocation: cloudTrip.start_location,
    endLocation: cloudTrip.end_location,
    startLatitude: cloudTrip.start_latitude,
    startLongitude: cloudTrip.start_longitude,
    endLatitude: cloudTrip.end_latitude,
    endLongitude: cloudTrip.end_longitude,
    distance: cloudTrip.distance,
    startTime: cloudTrip.start_time,
    endTime: cloudTrip.end_time,
    purpose: cloudTrip.purpose,
    notes: cloudTrip.notes,
    createdAt: new Date(cloudTrip.created_at).getTime(),
    updatedAt: new Date(cloudTrip.updated_at).getTime(),
  };
}

/**
 * Upload a trip to Supabase
 */
export async function uploadTrip(trip: Trip): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('[Sync] No user logged in, cannot upload trip');
      return false;
    }

    const cloudTrip = tripToCloudTrip(trip, user.id);

    // Check if trip already exists in cloud by matching start_time and end_time
    const { data: existing } = await supabase
      .from('trips')
      .select('id')
      .eq('user_id', user.id)
      .eq('start_time', trip.startTime)
      .eq('end_time', trip.endTime)
      .single();

    if (existing) {
      // Update existing trip
      const { error } = await supabase
        .from('trips')
        .update(cloudTrip)
        .eq('id', existing.id);

      if (error) {
        console.error('[Sync] Error updating trip in cloud:', error);
        return false;
      }

      console.log('[Sync] ✅ Updated trip in cloud:', trip.id);
    } else {
      // Insert new trip
      const { error } = await supabase
        .from('trips')
        .insert([cloudTrip]);

      if (error) {
        console.error('[Sync] Error uploading trip to cloud:', error);
        return false;
      }

      console.log('[Sync] ✅ Uploaded new trip to cloud:', trip.id);
    }

    return true;
  } catch (error) {
    console.error('[Sync] Unexpected error uploading trip:', error);
    return false;
  }
}

/**
 * Upload all local trips to cloud
 */
export async function uploadAllTrips(): Promise<{ success: number; failed: number }> {
  try {
    const trips = await getAllTrips();
    let success = 0;
    let failed = 0;

    console.log(`[Sync] Uploading ${trips.length} local trips to cloud...`);

    for (const trip of trips) {
      const uploaded = await uploadTrip(trip);
      if (uploaded) {
        success++;
      } else {
        failed++;
      }
    }

    console.log(`[Sync] Upload complete: ${success} succeeded, ${failed} failed`);
    return { success, failed };
  } catch (error) {
    console.error('[Sync] Error uploading all trips:', error);
    return { success: 0, failed: 0 };
  }
}

/**
 * Download all trips from cloud
 */
export async function downloadTrips(): Promise<Trip[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('[Sync] No user logged in, cannot download trips');
      return [];
    }

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('[Sync] Error downloading trips from cloud:', error);
      return [];
    }

    console.log(`[Sync] ✅ Downloaded ${data.length} trips from cloud`);

    // Convert cloud trips to local format
    const trips: Trip[] = data.map((cloudTrip) => ({
      id: parseInt(cloudTrip.id, 10), // Convert UUID to number for local DB compatibility
      ...cloudTripToTrip(cloudTrip),
    }));

    return trips;
  } catch (error) {
    console.error('[Sync] Unexpected error downloading trips:', error);
    return [];
  }
}

/**
 * Sync trips bidirectionally
 * This is a simple implementation - uploads all local trips and downloads all cloud trips
 * In a production app, you'd want more sophisticated conflict resolution
 */
export async function syncTrips(): Promise<{ uploaded: number; downloaded: number }> {
  try {
    console.log('[Sync] 🔄 Starting trip sync...');

    // 1. Upload all local trips to cloud
    const { success: uploaded } = await uploadAllTrips();

    // 2. Download all cloud trips (note: in a real app, you'd merge these with local)
    const cloudTrips = await downloadTrips();

    // 3. Update last sync timestamp
    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

    console.log(`[Sync] ✅ Sync complete: ${uploaded} uploaded, ${cloudTrips.length} in cloud`);

    return {
      uploaded,
      downloaded: cloudTrips.length,
    };
  } catch (error) {
    console.error('[Sync] Error during sync:', error);
    return { uploaded: 0, downloaded: 0 };
  }
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<number | null> {
  try {
    const timestamp = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return timestamp ? parseInt(timestamp, 10) : null;
  } catch (error) {
    console.error('[Sync] Error getting last sync time:', error);
    return null;
  }
}

/**
 * Mark a trip as deleted in the cloud (soft delete)
 */
export async function markTripDeleted(trip: Trip): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('[Sync] No user logged in, cannot mark trip as deleted');
      return false;
    }

    // Find the trip in cloud by matching start_time and end_time
    const { data: existing } = await supabase
      .from('trips')
      .select('id')
      .eq('user_id', user.id)
      .eq('start_time', trip.startTime)
      .eq('end_time', trip.endTime)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('trips')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('[Sync] Error marking trip as deleted:', error);
        return false;
      }

      console.log('[Sync] ✅ Marked trip as deleted in cloud');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Sync] Unexpected error marking trip as deleted:', error);
    return false;
  }
}

/**
 * Initialize sync on app start
 * Call this when the user logs in or app starts
 */
export async function initializeSync(): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('[Sync] Not logged in, skipping sync initialization');
      return;
    }

    console.log('[Sync] Initializing sync for user:', user.email);

    // Perform initial sync
    await syncTrips();
  } catch (error) {
    console.error('[Sync] Error initializing sync:', error);
  }
}
