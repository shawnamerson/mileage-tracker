import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export interface LocalTrip {
  id: string;
  user_id: string;
  start_location: string;
  end_location: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude: number;
  end_longitude: number;
  distance: number;
  start_time: number;
  end_time: number;
  purpose: 'business' | 'personal' | 'medical' | 'charity' | 'other';
  notes: string;
  created_at: number;
  updated_at: number;
}

/**
 * Initialize local SQLite database
 */
export async function initLocalDatabase(): Promise<void> {
  try {
    console.log('[LocalDB] Initializing SQLite database...');

    db = await SQLite.openDatabaseAsync('milemate.db');

    // Create trips table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        start_location TEXT NOT NULL,
        end_location TEXT NOT NULL,
        start_latitude REAL NOT NULL,
        start_longitude REAL NOT NULL,
        end_latitude REAL NOT NULL,
        end_longitude REAL NOT NULL,
        distance REAL NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        purpose TEXT NOT NULL,
        notes TEXT DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
      CREATE INDEX IF NOT EXISTS idx_trips_start_time ON trips(start_time);
    `);

    console.log('[LocalDB] ✅ Database initialized successfully');
  } catch (error) {
    console.error('[LocalDB] Error initializing database:', error);
    throw error;
  }
}

/**
 * Get all trips from local database
 */
export async function getLocalTrips(userId: string): Promise<LocalTrip[]> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const result = await db!.getAllAsync<LocalTrip>(
      'SELECT * FROM trips WHERE user_id = ? ORDER BY start_time DESC',
      [userId]
    );

    return result;
  } catch (error) {
    console.error('[LocalDB] Error getting trips:', error);
    return [];
  }
}

/**
 * Get trips for a specific date range
 */
export async function getLocalTripsByDateRange(
  userId: string,
  startTime: number,
  endTime: number
): Promise<LocalTrip[]> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const result = await db!.getAllAsync<LocalTrip>(
      'SELECT * FROM trips WHERE user_id = ? AND start_time >= ? AND start_time <= ? ORDER BY start_time DESC',
      [userId, startTime, endTime]
    );

    return result;
  } catch (error) {
    console.error('[LocalDB] Error getting trips by date range:', error);
    return [];
  }
}

/**
 * Save trip to local database
 */
export async function saveLocalTrip(trip: Omit<LocalTrip, 'created_at' | 'updated_at'>): Promise<void> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const now = Date.now();

    await db!.runAsync(
      `INSERT OR REPLACE INTO trips (
        id, user_id, start_location, end_location,
        start_latitude, start_longitude, end_latitude, end_longitude,
        distance, start_time, end_time, purpose, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trip.id,
        trip.user_id,
        trip.start_location,
        trip.end_location,
        trip.start_latitude,
        trip.start_longitude,
        trip.end_latitude,
        trip.end_longitude,
        trip.distance,
        trip.start_time,
        trip.end_time,
        trip.purpose,
        trip.notes || '',
        now,
        now,
      ]
    );

    console.log('[LocalDB] ✅ Trip saved locally:', trip.id);
  } catch (error) {
    console.error('[LocalDB] Error saving trip:', error);
    throw error;
  }
}

/**
 * Save or update active trip progress to SQLite (crash-safe)
 * This ensures trip data survives app crashes during tracking
 */
export async function saveActiveTripProgress(
  tripId: string,
  userId: string,
  data: {
    start_location: string;
    start_latitude: number;
    start_longitude: number;
    start_time: number;
    purpose: 'business' | 'personal' | 'medical' | 'charity' | 'other';
    notes: string;
    distance: number;
    last_latitude: number;
    last_longitude: number;
  }
): Promise<void> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const now = Date.now();

    // Use INSERT OR REPLACE to update existing trip or create new one
    await db!.runAsync(
      `INSERT OR REPLACE INTO trips (
        id, user_id, start_location, end_location,
        start_latitude, start_longitude, end_latitude, end_longitude,
        distance, start_time, end_time, purpose, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tripId,
        userId,
        data.start_location,
        'In Progress', // Placeholder - will be updated when trip completes
        data.start_latitude,
        data.start_longitude,
        data.last_latitude,
        data.last_longitude,
        data.distance,
        data.start_time,
        now, // end_time - will be updated when trip completes
        data.purpose,
        data.notes,
        data.start_time, // created_at
        now, // updated_at
      ]
    );

    console.log(`[LocalDB] ✅ Active trip progress saved: ${tripId} (${data.distance.toFixed(2)} mi)`);
  } catch (error) {
    console.error('[LocalDB] ❌ Error saving active trip progress:', error);
    throw error;
  }
}

/**
 * Delete trip from local database
 */
export async function deleteLocalTrip(tripId: string): Promise<void> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    await db!.runAsync('DELETE FROM trips WHERE id = ?', [tripId]);
    console.log('[LocalDB] ✅ Trip deleted locally:', tripId);
  } catch (error) {
    console.error('[LocalDB] Error deleting trip:', error);
    throw error;
  }
}

/**
 * Update trip in local database
 */
export async function updateLocalTrip(
  tripId: string,
  updates: {
    purpose?: 'business' | 'personal' | 'medical' | 'charity' | 'other';
    notes?: string;
  }
): Promise<void> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.purpose !== undefined) {
      updateFields.push('purpose = ?');
      updateValues.push(updates.purpose);
    }

    if (updates.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(updates.notes);
    }

    if (updateFields.length === 0) {
      return; // Nothing to update
    }

    // Mark as unsynced when updated
    updateFields.push('synced = 0');
    updateFields.push('updated_at = ?');
    updateValues.push(Date.now());

    // Add tripId to the end of values array
    updateValues.push(tripId);

    const sql = `UPDATE trips SET ${updateFields.join(', ')} WHERE id = ?`;

    await db!.runAsync(sql, updateValues);
    console.log('[LocalDB] ✅ Trip updated locally:', tripId);
  } catch (error) {
    console.error('[LocalDB] Error updating trip:', error);
    throw error;
  }
}

/**
 * Get trip statistics for today
 */
export async function getLocalTripStatsForToday(userId: string): Promise<{
  totalTrips: number;
  totalDistance: number;
  businessTrips: number;
  personalTrips: number;
  businessDistance: number;
  personalDistance: number;
}> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfDay = tomorrow.getTime();

    const result = await db!.getAllAsync<{
      purpose: string;
      count: number;
      total_distance: number;
    }>(
      `SELECT
        purpose,
        COUNT(*) as count,
        SUM(distance) as total_distance
      FROM trips
      WHERE user_id = ? AND start_time >= ? AND start_time < ?
      GROUP BY purpose`,
      [userId, startOfDay, endOfDay]
    );

    let totalTrips = 0;
    let totalDistance = 0;
    let businessTrips = 0;
    let personalTrips = 0;
    let businessDistance = 0;
    let personalDistance = 0;

    result.forEach(row => {
      totalTrips += row.count;
      totalDistance += row.total_distance;

      if (row.purpose === 'business') {
        businessTrips = row.count;
        businessDistance = row.total_distance;
      } else if (row.purpose === 'personal') {
        personalTrips = row.count;
        personalDistance = row.total_distance;
      }
    });

    return {
      totalTrips,
      totalDistance,
      businessTrips,
      personalTrips,
      businessDistance,
      personalDistance,
    };
  } catch (error) {
    console.error('[LocalDB] Error getting trip stats for today:', error);
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
 * Get business deductible value for today
 */
export async function getLocalBusinessDeductibleForToday(
  userId: string,
  ratePerMile: number
): Promise<number> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfDay = tomorrow.getTime();

    const result = await db!.getFirstAsync<{ total_distance: number }>(
      `SELECT SUM(distance) as total_distance
       FROM trips
       WHERE user_id = ? AND purpose = 'business' AND start_time >= ? AND start_time < ?`,
      [userId, startOfDay, endOfDay]
    );

    const totalDistance = result?.total_distance || 0;
    return totalDistance * ratePerMile;
  } catch (error) {
    console.error('[LocalDB] Error getting business deductible for today:', error);
    return 0;
  }
}

/**
 * Clear all local data (for logout)
 */
export async function clearLocalDatabase(): Promise<void> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    await db!.execAsync('DELETE FROM trips');
    console.log('[LocalDB] ✅ Local database cleared');
  } catch (error) {
    console.error('[LocalDB] Error clearing database:', error);
  }
}

/**
 * Get all trip statistics
 */
export async function getLocalTripStats(userId: string): Promise<{
  totalTrips: number;
  totalDistance: number;
  businessTrips: number;
  personalTrips: number;
  businessDistance: number;
  personalDistance: number;
}> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const result = await db!.getAllAsync<{
      purpose: string;
      count: number;
      total_distance: number;
    }>(
      `SELECT
        purpose,
        COUNT(*) as count,
        SUM(distance) as total_distance
      FROM trips
      WHERE user_id = ?
      GROUP BY purpose`,
      [userId]
    );

    let totalTrips = 0;
    let totalDistance = 0;
    let businessTrips = 0;
    let personalTrips = 0;
    let businessDistance = 0;
    let personalDistance = 0;

    result.forEach(row => {
      totalTrips += row.count;
      totalDistance += row.total_distance;

      if (row.purpose === 'business') {
        businessTrips = row.count;
        businessDistance = row.total_distance;
      } else if (row.purpose === 'personal') {
        personalTrips = row.count;
        personalDistance = row.total_distance;
      }
    });

    return {
      totalTrips,
      totalDistance,
      businessTrips,
      personalTrips,
      businessDistance,
      personalDistance,
    };
  } catch (error) {
    console.error('[LocalDB] Error getting trip stats:', error);
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
 * Get trip statistics for current month
 */
export async function getLocalTripStatsForCurrentMonth(userId: string): Promise<{
  totalTrips: number;
  totalDistance: number;
  businessTrips: number;
  personalTrips: number;
  businessDistance: number;
  personalDistance: number;
}> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    const result = await db!.getAllAsync<{
      purpose: string;
      count: number;
      total_distance: number;
    }>(
      `SELECT
        purpose,
        COUNT(*) as count,
        SUM(distance) as total_distance
      FROM trips
      WHERE user_id = ? AND start_time >= ? AND start_time < ?
      GROUP BY purpose`,
      [userId, startOfMonth, endOfMonth]
    );

    let totalTrips = 0;
    let totalDistance = 0;
    let businessTrips = 0;
    let personalTrips = 0;
    let businessDistance = 0;
    let personalDistance = 0;

    result.forEach(row => {
      totalTrips += row.count;
      totalDistance += row.total_distance;

      if (row.purpose === 'business') {
        businessTrips = row.count;
        businessDistance = row.total_distance;
      } else if (row.purpose === 'personal') {
        personalTrips = row.count;
        personalDistance = row.total_distance;
      }
    });

    return {
      totalTrips,
      totalDistance,
      businessTrips,
      personalTrips,
      businessDistance,
      personalDistance,
    };
  } catch (error) {
    console.error('[LocalDB] Error getting trip stats for current month:', error);
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
export async function getLocalTripStatsForYear(userId: string, year: number): Promise<{
  totalTrips: number;
  totalDistance: number;
  businessTrips: number;
  personalTrips: number;
  businessDistance: number;
  personalDistance: number;
}> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const startOfYear = new Date(year, 0, 1).getTime();
    const endOfYear = new Date(year + 1, 0, 1).getTime();

    const result = await db!.getAllAsync<{
      purpose: string;
      count: number;
      total_distance: number;
    }>(
      `SELECT
        purpose,
        COUNT(*) as count,
        SUM(distance) as total_distance
      FROM trips
      WHERE user_id = ? AND start_time >= ? AND start_time < ?
      GROUP BY purpose`,
      [userId, startOfYear, endOfYear]
    );

    let totalTrips = 0;
    let totalDistance = 0;
    let businessTrips = 0;
    let personalTrips = 0;
    let businessDistance = 0;
    let personalDistance = 0;

    result.forEach(row => {
      totalTrips += row.count;
      totalDistance += row.total_distance;

      if (row.purpose === 'business') {
        businessTrips = row.count;
        businessDistance = row.total_distance;
      } else if (row.purpose === 'personal') {
        personalTrips = row.count;
        personalDistance = row.total_distance;
      }
    });

    return {
      totalTrips,
      totalDistance,
      businessTrips,
      personalTrips,
      businessDistance,
      personalDistance,
    };
  } catch (error) {
    console.error('[LocalDB] Error getting trip stats for year:', error);
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
 * Get business deductible value for current month
 */
export async function getLocalBusinessDeductibleForCurrentMonth(
  userId: string,
  ratePerMile: number
): Promise<number> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    const result = await db!.getFirstAsync<{ total_distance: number }>(
      `SELECT SUM(distance) as total_distance
       FROM trips
       WHERE user_id = ? AND purpose = 'business' AND start_time >= ? AND start_time < ?`,
      [userId, startOfMonth, endOfMonth]
    );

    const totalDistance = result?.total_distance || 0;
    return totalDistance * ratePerMile;
  } catch (error) {
    console.error('[LocalDB] Error getting business deductible for current month:', error);
    return 0;
  }
}

/**
 * Get business deductible value for a specific year
 */
export async function getLocalBusinessDeductibleForYear(
  userId: string,
  year: number,
  ratePerMile: number
): Promise<number> {
  if (!db) {
    await initLocalDatabase();
  }

  try {
    const startOfYear = new Date(year, 0, 1).getTime();
    const endOfYear = new Date(year + 1, 0, 1).getTime();

    const result = await db!.getFirstAsync<{ total_distance: number }>(
      `SELECT SUM(distance) as total_distance
       FROM trips
       WHERE user_id = ? AND purpose = 'business' AND start_time >= ? AND start_time < ?`,
      [userId, startOfYear, endOfYear]
    );

    const totalDistance = result?.total_distance || 0;
    return totalDistance * ratePerMile;
  } catch (error) {
    console.error('[LocalDB] Error getting business deductible for year:', error);
    return 0;
  }
}
