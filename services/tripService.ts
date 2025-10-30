import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from './tripTypes';
import {
  saveLocalTrip,
  getLocalTrips,
  getLocalTripsByDateRange,
  updateLocalTrip as updateLocalTripDB,
  deleteLocalTrip,
  getLocalTripStats,
  getLocalTripStatsForToday,
  getLocalTripStatsForCurrentMonth,
  getLocalTripStatsForYear,
  getLocalBusinessDeductibleForToday,
  getLocalBusinessDeductibleForCurrentMonth,
  getLocalBusinessDeductibleForYear,
  LocalTrip,
} from './localDatabase';
import { getRateForYear } from './mileageRateService';
import { backupToICloud, isICloudBackupEnabled } from './iCloudBackup';

// Re-export Trip type for backward compatibility
export type { Trip };

const USER_ID_KEY = 'user_id';

/**
 * Get current user ID from local storage
 */
async function getCurrentUserId(): Promise<string> {
  const userId = await AsyncStorage.getItem(USER_ID_KEY);
  if (!userId) {
    throw new Error('No user logged in');
  }
  return userId;
}

/**
 * Generate a unique trip ID
 */
function generateTripId(): string {
  return `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert LocalTrip to Trip format (for backward compatibility)
 */
function localTripToTrip(localTrip: LocalTrip): Trip {
  return {
    id: localTrip.id,
    user_id: localTrip.user_id,
    start_location: localTrip.start_location,
    end_location: localTrip.end_location,
    start_latitude: localTrip.start_latitude,
    start_longitude: localTrip.start_longitude,
    end_latitude: localTrip.end_latitude,
    end_longitude: localTrip.end_longitude,
    distance: localTrip.distance,
    start_time: localTrip.start_time,
    end_time: localTrip.end_time,
    purpose: localTrip.purpose,
    notes: localTrip.notes,
    created_at: new Date(localTrip.created_at).toISOString(),
    updated_at: new Date(localTrip.updated_at).toISOString(),
  };
}

/**
 * Validates trip data before saving
 */
function validateTrip(trip: Omit<Trip, 'id' | 'user_id' | 'created_at' | 'updated_at'>): void {
  // Required fields
  if (!trip.start_location || trip.start_location.trim() === '') {
    throw new Error('Start location is required');
  }

  if (!trip.end_location || trip.end_location.trim() === '') {
    throw new Error('End location is required');
  }

  if (typeof trip.distance !== 'number' || trip.distance <= 0) {
    throw new Error('Distance must be a positive number');
  }

  if (trip.distance > 10000) {
    throw new Error('Distance seems unreasonably large (over 10,000 miles)');
  }

  if (!trip.start_time || typeof trip.start_time !== 'number') {
    throw new Error('Start time is required');
  }

  if (!trip.end_time || typeof trip.end_time !== 'number') {
    throw new Error('End time is required');
  }

  if (trip.end_time < trip.start_time) {
    throw new Error('End time must be after start time');
  }

  // Check if trip is in the future
  const now = Date.now();
  if (trip.start_time > now + 86400000) {
    // Allow up to 1 day in future for timezone issues
    throw new Error('Trip cannot start in the future');
  }

  // Check if trip is too old (more than 10 years)
  const tenYearsAgo = now - 10 * 365 * 24 * 60 * 60 * 1000;
  if (trip.start_time < tenYearsAgo) {
    throw new Error('Trip date cannot be more than 10 years ago');
  }

  // Validate purpose
  const validPurposes = ['business', 'personal', 'medical', 'charity', 'other'];
  if (!validPurposes.includes(trip.purpose)) {
    throw new Error('Invalid trip purpose');
  }

  // Validate coordinates
  if (trip.start_latitude < -90 || trip.start_latitude > 90) {
    throw new Error('Invalid start latitude');
  }

  if (trip.start_longitude < -180 || trip.start_longitude > 180) {
    throw new Error('Invalid start longitude');
  }

  if (trip.end_latitude < -90 || trip.end_latitude > 90) {
    throw new Error('Invalid end latitude');
  }

  if (trip.end_longitude < -180 || trip.end_longitude > 180) {
    throw new Error('Invalid end longitude');
  }

  // Validate notes length if provided
  if (trip.notes && trip.notes.length > 1000) {
    throw new Error('Notes cannot exceed 1000 characters');
  }
}

/**
 * Create a new trip (offline-first)
 */
export async function createTrip(
  trip: Omit<Trip, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Trip> {
  // Validate trip data
  validateTrip(trip);

  try {
    const userId = await getCurrentUserId();
    const tripId = generateTripId();

    // Save to local database
    await saveLocalTrip({
      id: tripId,
      user_id: userId,
      start_location: trip.start_location,
      end_location: trip.end_location,
      start_latitude: trip.start_latitude,
      start_longitude: trip.start_longitude,
      end_latitude: trip.end_latitude,
      end_longitude: trip.end_longitude,
      distance: trip.distance,
      start_time: trip.start_time,
      end_time: trip.end_time,
      purpose: trip.purpose,
      notes: trip.notes || '',
    });

    console.log('[Trip Create] ✅ Trip saved to local database:', tripId);

    // Auto-backup to iCloud if enabled (non-blocking)
    autoBackupToICloud();

    // Return the trip in expected format
    return {
      id: tripId,
      user_id: userId,
      ...trip,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Trip Create] Error creating trip:', error);
    throw error;
  }
}

/**
 * Get all trips for the current user
 */
export async function getAllTrips(): Promise<Trip[]> {
  try {
    const userId = await getCurrentUserId();
    const localTrips = await getLocalTrips(userId);

    return localTrips.map(localTripToTrip);
  } catch (error) {
    console.error('Error getting all trips:', error);
    return [];
  }
}

/**
 * Get a single trip by ID
 */
export async function getTripById(id: string): Promise<Trip | null> {
  try {
    const userId = await getCurrentUserId();
    const localTrips = await getLocalTrips(userId);
    const trip = localTrips.find(t => t.id === id);

    return trip ? localTripToTrip(trip) : null;
  } catch (error) {
    console.error('Error getting trip:', error);
    return null;
  }
}

/**
 * Get trips filtered by purpose
 */
export async function getTripsByPurpose(purpose: string): Promise<Trip[]> {
  try {
    const userId = await getCurrentUserId();
    const localTrips = await getLocalTrips(userId);
    const filtered = localTrips.filter(t => t.purpose === purpose);

    return filtered.map(localTripToTrip);
  } catch (error) {
    console.error('Error getting trips by purpose:', error);
    return [];
  }
}

/**
 * Get trips within a date range
 */
export async function getTripsByDateRange(startDate: number, endDate: number): Promise<Trip[]> {
  try {
    const userId = await getCurrentUserId();
    const localTrips = await getLocalTripsByDateRange(userId, startDate, endDate);

    return localTrips.map(localTripToTrip);
  } catch (error) {
    console.error('Error getting trips by date range:', error);
    return [];
  }
}

/**
 * Update an existing trip
 */
export async function updateTrip(
  id: string,
  trip: Partial<Omit<Trip, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  try {
    const userId = await getCurrentUserId();

    // Only allow updating purpose and notes (as defined in updateLocalTrip)
    const updates: { purpose?: any; notes?: string } = {};

    if (trip.purpose !== undefined) {
      updates.purpose = trip.purpose;
    }

    if (trip.notes !== undefined) {
      updates.notes = trip.notes;
    }

    await updateLocalTripDB(id, updates);
    console.log('[Trip Update] ✅ Trip updated:', id);

    // Auto-backup to iCloud if enabled (non-blocking)
    autoBackupToICloud();
  } catch (error) {
    console.error('Error updating trip:', error);
    throw error;
  }
}

/**
 * Delete a trip
 */
export async function deleteTrip(id: string): Promise<void> {
  if (!id) {
    throw new Error('Invalid trip ID');
  }

  try {
    const userId = await getCurrentUserId();
    await deleteLocalTrip(id);
    console.log('[Trip Delete] ✅ Trip deleted:', id);
  } catch (error) {
    console.error('[Trip Delete] Error deleting trip:', error);
    throw error;
  }
}

/**
 * Get overall trip statistics
 */
export async function getTripStats(): Promise<{
  totalTrips: number;
  totalDistance: number;
  businessTrips: number;
  personalTrips: number;
  businessDistance: number;
  personalDistance: number;
}> {
  try {
    const userId = await getCurrentUserId();
    return await getLocalTripStats(userId);
  } catch (error) {
    console.error('Error getting trip stats:', error);
    return {
      totalTrips: 0,
      totalDistance: 0,
      businessTrips: 0,
      personalTrips: 0,
      businessDistance: 0,
      personalDistance: 0,
    };
  }
}

/**
 * Get trip statistics for a specific year
 */
export async function getTripStatsForYear(year: number): Promise<{
  totalTrips: number;
  totalDistance: number;
  businessTrips: number;
  personalTrips: number;
  businessDistance: number;
  personalDistance: number;
}> {
  try {
    const userId = await getCurrentUserId();
    return await getLocalTripStatsForYear(userId, year);
  } catch (error) {
    console.error('Error getting trip stats for year:', error);
    return {
      totalTrips: 0,
      totalDistance: 0,
      businessTrips: 0,
      personalTrips: 0,
      businessDistance: 0,
      personalDistance: 0,
    };
  }
}

/**
 * Get trip statistics for today
 */
export async function getTripStatsForToday(): Promise<{
  totalTrips: number;
  totalDistance: number;
  businessTrips: number;
  personalTrips: number;
  businessDistance: number;
  personalDistance: number;
}> {
  try {
    const userId = await getCurrentUserId();
    return await getLocalTripStatsForToday(userId);
  } catch (error) {
    console.error('Error getting trip stats for today:', error);
    return {
      totalTrips: 0,
      totalDistance: 0,
      businessTrips: 0,
      personalTrips: 0,
      businessDistance: 0,
      personalDistance: 0,
    };
  }
}

/**
 * Get trip statistics for the current month
 */
export async function getTripStatsForCurrentMonth(): Promise<{
  totalTrips: number;
  totalDistance: number;
  businessTrips: number;
  personalTrips: number;
  businessDistance: number;
  personalDistance: number;
}> {
  try {
    const userId = await getCurrentUserId();
    return await getLocalTripStatsForCurrentMonth(userId);
  } catch (error) {
    console.error('Error getting trip stats for current month:', error);
    return {
      totalTrips: 0,
      totalDistance: 0,
      businessTrips: 0,
      personalTrips: 0,
      businessDistance: 0,
      personalDistance: 0,
    };
  }
}

/**
 * Get monthly statistics for a specific month
 */
export async function getMonthlyStats(
  year: number,
  month: number
): Promise<{
  trips: number;
  distance: number;
  businessDistance: number;
}> {
  try {
    const userId = await getCurrentUserId();
    const startOfMonth = new Date(year, month - 1, 1).getTime();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const trips = await getLocalTripsByDateRange(userId, startOfMonth, endOfMonth);
    const businessTrips = trips.filter(t => t.purpose === 'business');

    return {
      trips: trips.length,
      distance: trips.reduce((sum, t) => sum + t.distance, 0),
      businessDistance: businessTrips.reduce((sum, t) => sum + t.distance, 0),
    };
  } catch (error) {
    console.error('Error getting monthly stats:', error);
    return { trips: 0, distance: 0, businessDistance: 0 };
  }
}

/**
 * Calculate the total deductible value of business trips using year-specific rates
 */
export async function getBusinessDeductibleValue(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    const trips = await getLocalTrips(userId);
    const businessTrips = trips.filter(t => t.purpose === 'business');

    if (businessTrips.length === 0) {
      return 0;
    }

    // Group by year and calculate
    const yearTotals = new Map<number, number>();
    businessTrips.forEach((trip) => {
      const year = new Date(trip.start_time).getFullYear();
      yearTotals.set(year, (yearTotals.get(year) || 0) + trip.distance);
    });

    // Batch load all needed rates (prevents N+1 query problem)
    const years = Array.from(yearTotals.keys());
    const ratesArray = await Promise.all(years.map(year => getRateForYear(year)));
    const ratesByYear = new Map(years.map((year, i) => [year, ratesArray[i]]));

    // Calculate total value using batch-loaded rates
    let totalValue = 0;
    for (const [year, distance] of yearTotals) {
      const rate = ratesByYear.get(year)!;
      totalValue += distance * rate;
    }

    return totalValue;
  } catch (error) {
    console.error('Error calculating business deductible value:', error);
    return 0;
  }
}

/**
 * Calculate the deductible value of business trips for a specific year
 */
export async function getBusinessDeductibleValueForYear(year: number): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    const rate = await getRateForYear(year);
    return await getLocalBusinessDeductibleForYear(userId, year, rate);
  } catch (error) {
    console.error('Error calculating business deductible value for year:', error);
    return 0;
  }
}

/**
 * Calculate the deductible value of business trips for today
 */
export async function getBusinessDeductibleValueForToday(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    const currentYear = new Date().getFullYear();
    const rate = await getRateForYear(currentYear);
    return await getLocalBusinessDeductibleForToday(userId, rate);
  } catch (error) {
    console.error('Error calculating business deductible value for today:', error);
    return 0;
  }
}

/**
 * Calculate the deductible value of business trips for the current month
 */
export async function getBusinessDeductibleValueForCurrentMonth(): Promise<number> {
  try {
    const userId = await getCurrentUserId();
    const currentYear = new Date().getFullYear();
    const rate = await getRateForYear(currentYear);
    return await getLocalBusinessDeductibleForCurrentMonth(userId, rate);
  } catch (error) {
    console.error('Error calculating business deductible value for current month:', error);
    return 0;
  }
}

/**
 * Auto-backup to iCloud if enabled (runs in background, non-blocking)
 */
function autoBackupToICloud(): void {
  // Run backup in background without blocking the UI
  (async () => {
    try {
      const enabled = await isICloudBackupEnabled();
      if (enabled) {
        console.log('[Trip] Auto-backing up to iCloud...');
        await backupToICloud();
        console.log('[Trip] ✅ Auto-backup to iCloud complete');
      }
    } catch (error) {
      console.error('[Trip] Error during auto-backup to iCloud:', error);
      // Don't throw - backup failures should not block trip operations
    }
  })();
}
