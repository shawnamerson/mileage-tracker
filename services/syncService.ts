import { supabase, CloudTrip } from './supabase';
import { Trip } from './tripTypes';
import { getCurrentUser } from './authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getQueue,
  saveQueue,
  addToQueue,
  getQueueStatus,
  clearFailedOperations,
  SyncErrorType,
  type SyncError,
  type QueuedOperation,
} from './offlineQueue';

const LAST_SYNC_KEY = 'last_sync_timestamp';
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Re-export for backward compatibility
export { SyncErrorType, addToQueue, getQueueStatus, clearFailedOperations };
export type { SyncError, QueuedOperation };

/**
 * Convert local trip to cloud format (they're now the same)
 */
function tripToCloudTrip(trip: Trip, userId: string): Omit<CloudTrip, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    start_location: trip.start_location,
    end_location: trip.end_location,
    start_latitude: trip.start_latitude || 0,
    start_longitude: trip.start_longitude || 0,
    end_latitude: trip.end_latitude || 0,
    end_longitude: trip.end_longitude || 0,
    distance: trip.distance,
    start_time: trip.start_time,
    end_time: trip.end_time,
    purpose: trip.purpose,
    notes: trip.notes || '',
    is_deleted: false,
    deleted_at: null,
  };
}

/**
 * Convert cloud trip to local format (they're now the same)
 */
function cloudTripToTrip(cloudTrip: CloudTrip): Trip {
  return {
    id: cloudTrip.id,
    user_id: cloudTrip.user_id,
    start_location: cloudTrip.start_location,
    end_location: cloudTrip.end_location,
    start_latitude: cloudTrip.start_latitude,
    start_longitude: cloudTrip.start_longitude,
    end_latitude: cloudTrip.end_latitude,
    end_longitude: cloudTrip.end_longitude,
    distance: cloudTrip.distance,
    start_time: cloudTrip.start_time,
    end_time: cloudTrip.end_time,
    purpose: cloudTrip.purpose,
    notes: cloudTrip.notes,
    created_at: cloudTrip.created_at,
    updated_at: cloudTrip.updated_at,
    is_deleted: cloudTrip.is_deleted,
    deleted_at: cloudTrip.deleted_at || undefined,
  };
}

/**
 * Categorize errors for better handling
 */
function categorizeError(error: any): SyncError {
  const errorMessage = error?.message || String(error);

  // Network errors
  if (
    errorMessage.includes('fetch') ||
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('offline') ||
    error?.code === 'NETWORK_ERROR'
  ) {
    return {
      type: SyncErrorType.NETWORK,
      message: 'Network error - check your connection',
      retryable: true,
    };
  }

  // Auth errors
  if (
    errorMessage.includes('auth') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('token') ||
    error?.code === 'PGRST301'
  ) {
    return {
      type: SyncErrorType.AUTH,
      message: 'Authentication error - please sign in again',
      retryable: false,
    };
  }

  // Server errors (5xx)
  if (
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503') ||
    errorMessage.includes('504') ||
    error?.status >= 500
  ) {
    return {
      type: SyncErrorType.SERVER,
      message: 'Server error - will retry automatically',
      retryable: true,
    };
  }

  // Validation errors (4xx)
  if (
    errorMessage.includes('400') ||
    errorMessage.includes('invalid') ||
    errorMessage.includes('validation') ||
    (error?.status >= 400 && error?.status < 500)
  ) {
    return {
      type: SyncErrorType.VALIDATION,
      message: 'Invalid data - check trip details',
      retryable: false,
    };
  }

  return {
    type: SyncErrorType.UNKNOWN,
    message: errorMessage,
    retryable: true, // Default to retryable for unknown errors
  };
}


/**
 * Process offline queue with retry logic
 */
export async function processQueue(): Promise<{
  processed: number;
  failed: number;
}> {
  try {
    const queue = await getQueue();
    if (queue.length === 0) {
      console.log('[Sync Queue] Queue is empty');
      return { processed: 0, failed: 0 };
    }

    console.log(`[Sync Queue] Processing ${queue.length} queued operations...`);

    let processed = 0;
    let failed = 0;
    const remainingQueue: QueuedOperation[] = [];

    for (const operation of queue) {
      // Check if we've exceeded max retry attempts
      if (operation.attempts >= MAX_RETRY_ATTEMPTS) {
        console.error(
          `[Sync Queue] Max retries exceeded for operation ${operation.id}`
        );
        failed++;
        // Keep in queue but don't process - user can manually retry later
        remainingQueue.push(operation);
        continue;
      }

      // Exponential backoff: wait longer between retries
      if (operation.lastAttempt) {
        const timeSinceLastAttempt = Date.now() - operation.lastAttempt;
        const requiredDelay = INITIAL_RETRY_DELAY * Math.pow(2, operation.attempts);

        if (timeSinceLastAttempt < requiredDelay) {
          console.log(
            `[Sync Queue] Skipping operation ${operation.id} - waiting for backoff`
          );
          remainingQueue.push(operation);
          continue;
        }
      }

      // Update attempt tracking
      operation.attempts++;
      operation.lastAttempt = Date.now();

      // Try to process the operation
      let success = false;

      try {
        if (operation.type === 'upload') {
          success = await uploadTrip(operation.trip);
        } else if (operation.type === 'delete') {
          success = await markTripDeleted(operation.trip);
        } else if (operation.type === 'create') {
          success = await createTripInCloud(operation.trip);
        }

        if (success) {
          console.log(`[Sync Queue] ✅ Processed operation ${operation.id}`);
          processed++;
        } else {
          throw new Error('Operation failed');
        }
      } catch (error) {
        const syncError = categorizeError(error);
        operation.error = syncError;

        console.error(
          `[Sync Queue] ❌ Operation ${operation.id} failed (attempt ${operation.attempts}):`,
          syncError.message
        );

        if (syncError.retryable) {
          // Keep in queue for retry
          remainingQueue.push(operation);
        } else {
          // Non-retryable error - remove from queue
          console.error(
            `[Sync Queue] Removing non-retryable operation ${operation.id}`
          );
          failed++;
        }
      }
    }

    // Save the remaining queue
    await saveQueue(remainingQueue);

    console.log(
      `[Sync Queue] Processing complete: ${processed} succeeded, ${failed} failed, ${remainingQueue.length} remaining`
    );

    return { processed, failed };
  } catch (error) {
    console.error('[Sync Queue] Error processing queue:', error);
    return { processed: 0, failed: 0 };
  }
}


/**
 * Upload a trip to Supabase with conflict resolution
 */
export async function uploadTrip(trip: Trip, addToQueueOnFailure = true): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('[Sync] No user logged in, cannot upload trip');
      return false;
    }

    const cloudTrip = tripToCloudTrip(trip, user.id);

    // Check if trip already exists in cloud by matching start_time and end_time
    const { data: existing, error: fetchError } = await supabase
      .from('trips')
      .select('id, updated_at')
      .eq('user_id', user.id)
      .eq('start_time', trip.start_time)
      .eq('end_time', trip.end_time)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existing) {
      // Conflict resolution: check which version is newer
      const cloudUpdatedAt = new Date(existing.updated_at || 0).getTime();
      const localUpdatedAt = new Date(trip.updated_at || 0).getTime();

      if (cloudUpdatedAt > localUpdatedAt) {
        console.log(
          `[Sync] ⚠️ Cloud version is newer for trip ${trip.id} - skipping upload`
        );
        return true; // Not an error, just skip upload
      }

      // Update existing trip
      const { error } = await supabase
        .from('trips')
        .update(cloudTrip)
        .eq('id', existing.id);

      if (error) {
        throw error;
      }

      console.log('[Sync] ✅ Updated trip in cloud:', trip.id);
    } else {
      // Insert new trip
      const { error } = await supabase
        .from('trips')
        .insert([cloudTrip]);

      if (error) {
        throw error;
      }

      console.log('[Sync] ✅ Uploaded new trip to cloud:', trip.id);
    }

    return true;
  } catch (error) {
    const syncError = categorizeError(error);
    console.error(
      `[Sync] Error uploading trip ${trip.id}:`,
      syncError.type,
      syncError.message
    );

    // Add to queue for retry if this was a retryable error and we're not already processing the queue
    if (addToQueueOnFailure && syncError.retryable) {
      await addToQueue('upload', trip);
    }

    return false;
  }
}

/**
 * Create a new trip in the cloud (used by offline queue)
 * This is for trips that failed to save initially
 * Does NOT update vehicle mileage (already done by original createTrip attempt)
 */
export async function createTripInCloud(trip: Trip, addToQueueOnFailure = true): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('[Sync] No user logged in, cannot create trip');
      return false;
    }

    const cloudTrip = tripToCloudTrip(trip, user.id);

    // Insert new trip in Supabase
    const { error } = await supabase
      .from('trips')
      .insert([cloudTrip]);

    if (error) {
      throw error;
    }

    console.log('[Sync] ✅ Created trip in cloud via queue');
    return true;
  } catch (error) {
    const syncError = categorizeError(error);
    console.error(
      `[Sync] Error creating trip in cloud:`,
      syncError.type,
      syncError.message
    );

    // Add to queue for retry if this was a retryable error and we're not already processing the queue
    if (addToQueueOnFailure && syncError.retryable) {
      await addToQueue('create', trip);
    }

    return false;
  }
}

/**
 * Upload all local trips to cloud
 * Now continues even if some trips fail (doesn't stop on first failure)
 */
export async function uploadAllTrips(): Promise<{ success: number; failed: number }> {
  try {
    // Get trips directly from Supabase to avoid circular dependency
    const user = await getCurrentUser();
    if (!user) {
      console.error('[Sync] No user logged in');
      return { success: 0, failed: 0 };
    }

    const { data: trips, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('[Sync] Error fetching trips:', error);
      return { success: 0, failed: 0 };
    }

    const tripList = (trips || []).map(cloudTripToTrip);
    let success = 0;
    let failed = 0;

    console.log(`[Sync] Uploading ${tripList.length} local trips to cloud...`);

    // Upload trips in parallel for better performance (batch of 5 at a time)
    const batchSize = 5;
    for (let i = 0; i < tripList.length; i += batchSize) {
      const batch = tripList.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((trip) => uploadTrip(trip))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          success++;
        } else {
          failed++;
          console.error(
            `[Sync] Failed to upload trip ${batch[index].id}:`,
            result.status === 'rejected' ? result.reason : 'Upload returned false'
          );
        }
      });
    }

    console.log(`[Sync] Upload complete: ${success} succeeded, ${failed} failed`);
    return { success, failed };
  } catch (error) {
    const syncError = categorizeError(error);
    console.error('[Sync] Error uploading all trips:', syncError.message);
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
    return data.map(cloudTripToTrip);
  } catch (error) {
    console.error('[Sync] Unexpected error downloading trips:', error);
    return [];
  }
}

/**
 * Sync trips bidirectionally with intelligent conflict resolution
 * Now includes offline queue processing and proper merge strategy
 */
export async function syncTrips(): Promise<{
  uploaded: number;
  downloaded: number;
  queueProcessed: number;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    console.log('[Sync] 🔄 Starting trip sync...');

    // 1. First, process any queued operations from previous failed syncs
    console.log('[Sync] Processing offline queue...');
    const { processed: queueProcessed, failed: queueFailed } = await processQueue();

    if (queueFailed > 0) {
      errors.push(`${queueFailed} queued operations failed after retries`);
    }

    // 2. Upload all local trips to cloud
    console.log('[Sync] Uploading local trips...');
    const { success: uploaded, failed: uploadFailed } = await uploadAllTrips();

    if (uploadFailed > 0) {
      errors.push(`${uploadFailed} trips failed to upload (added to queue)`);
    }

    // 3. Download all cloud trips
    console.log('[Sync] Downloading cloud trips...');
    const cloudTrips = await downloadTrips();

    // 4. Update last sync timestamp
    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());

    const queueStatus = await getQueueStatus();
    if (queueStatus.pending > 0) {
      console.log(`[Sync] ⚠️ ${queueStatus.pending} operations pending in queue`);
    }

    console.log(
      `[Sync] ✅ Sync complete: ${uploaded} uploaded, ${cloudTrips.length} in cloud, ${queueProcessed} from queue`
    );

    return {
      uploaded,
      downloaded: cloudTrips.length,
      queueProcessed,
      errors,
    };
  } catch (error) {
    const syncError = categorizeError(error);
    console.error('[Sync] Error during sync:', syncError.message);
    errors.push(`Sync failed: ${syncError.message}`);

    return {
      uploaded: 0,
      downloaded: 0,
      queueProcessed: 0,
      errors,
    };
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
 * Now with error categorization and queue support
 */
export async function markTripDeleted(trip: Trip, addToQueueOnFailure = true): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('[Sync] No user logged in, cannot mark trip as deleted');
      return false;
    }

    // Find the trip in cloud by matching start_time and end_time
    const { data: existing, error: fetchError } = await supabase
      .from('trips')
      .select('id')
      .eq('user_id', user.id)
      .eq('start_time', trip.start_time)
      .eq('end_time', trip.end_time)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (existing) {
      const { error } = await supabase
        .from('trips')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        throw error;
      }

      console.log('[Sync] ✅ Marked trip as deleted in cloud');
      return true;
    }

    // Trip not found in cloud - this might be okay (already deleted or never synced)
    console.log('[Sync] Trip not found in cloud, nothing to delete');
    return true;
  } catch (error) {
    const syncError = categorizeError(error);
    console.error(
      `[Sync] Error marking trip ${trip.id} as deleted:`,
      syncError.type,
      syncError.message
    );

    // Add to queue for retry if this was a retryable error
    if (addToQueueOnFailure && syncError.retryable) {
      await addToQueue('delete', trip);
    }

    return false;
  }
}

/**
 * Initialize sync on app start
 * Call this when the user logs in or app starts
 *
 * IMPORTANT: This is lightweight to prevent blocking app startup.
 * Only processes the offline queue, full sync happens in background.
 */
export async function initializeSync(): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('[Sync] Not logged in, skipping sync initialization');
      return;
    }

    console.log('[Sync] Initializing sync for user:', user.email);

    // Only process offline queue on startup (fast)
    // This ensures failed operations get retried without blocking the UI
    const queueStatus = await getQueueStatus();

    if (queueStatus.pending > 0) {
      console.log(`[Sync] Processing ${queueStatus.pending} pending operations...`);
      // Process queue in background - don't await
      processQueue().catch((error) => {
        console.error('[Sync] Error processing queue on startup:', error);
      });
    }

    // Defer full sync to avoid blocking startup
    // Run full sync 5 seconds after app starts (when user is already in the app)
    setTimeout(() => {
      console.log('[Sync] Running deferred full sync...');
      syncTrips().catch((error) => {
        console.error('[Sync] Error in deferred sync:', error);
      });
    }, 5000);
  } catch (error) {
    console.error('[Sync] Error initializing sync:', error);
  }
}
