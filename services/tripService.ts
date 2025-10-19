import { getDatabase, Trip } from './database';
import { getRateForYear } from './mileageRateService';
import { getActiveVehicle, updateVehicleMileage } from './vehicleService';

/**
 * Validates trip data before saving
 */
function validateTrip(trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): void {
  // Required fields
  if (!trip.startLocation || trip.startLocation.trim() === '') {
    throw new Error('Start location is required');
  }

  if (!trip.endLocation || trip.endLocation.trim() === '') {
    throw new Error('End location is required');
  }

  if (typeof trip.distance !== 'number' || trip.distance <= 0) {
    throw new Error('Distance must be a positive number');
  }

  if (trip.distance > 10000) {
    throw new Error('Distance seems unreasonably large (over 10,000 miles)');
  }

  if (!trip.startTime || typeof trip.startTime !== 'number') {
    throw new Error('Start time is required');
  }

  if (!trip.endTime || typeof trip.endTime !== 'number') {
    throw new Error('End time is required');
  }

  if (trip.endTime < trip.startTime) {
    throw new Error('End time must be after start time');
  }

  // Check if trip is in the future
  const now = Date.now();
  if (trip.startTime > now + 86400000) {
    // Allow up to 1 day in future for timezone issues
    throw new Error('Trip cannot start in the future');
  }

  // Check if trip is too old (more than 10 years)
  const tenYearsAgo = now - 10 * 365 * 24 * 60 * 60 * 1000;
  if (trip.startTime < tenYearsAgo) {
    throw new Error('Trip date cannot be more than 10 years ago');
  }

  // Validate purpose
  const validPurposes = ['business', 'personal', 'medical', 'charity', 'other'];
  if (!validPurposes.includes(trip.purpose)) {
    throw new Error('Invalid trip purpose');
  }

  // Validate coordinates if provided
  if (trip.startLatitude !== undefined && trip.startLatitude !== null) {
    if (trip.startLatitude < -90 || trip.startLatitude > 90) {
      throw new Error('Invalid start latitude');
    }
  }

  if (trip.startLongitude !== undefined && trip.startLongitude !== null) {
    if (trip.startLongitude < -180 || trip.startLongitude > 180) {
      throw new Error('Invalid start longitude');
    }
  }

  if (trip.endLatitude !== undefined && trip.endLatitude !== null) {
    if (trip.endLatitude < -90 || trip.endLatitude > 90) {
      throw new Error('Invalid end latitude');
    }
  }

  if (trip.endLongitude !== undefined && trip.endLongitude !== null) {
    if (trip.endLongitude < -180 || trip.endLongitude > 180) {
      throw new Error('Invalid end longitude');
    }
  }

  // Validate notes length if provided
  if (trip.notes && trip.notes.length > 1000) {
    throw new Error('Notes cannot exceed 1000 characters');
  }
}

export async function createTrip(trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  // Validate trip data
  validateTrip(trip);

  const db = getDatabase();
  const now = Date.now();

  try {
    const result = await db.runAsync(
      `INSERT INTO trips (
        startLocation, endLocation, startLatitude, startLongitude,
        endLatitude, endLongitude, distance, startTime, endTime,
        purpose, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trip.startLocation,
        trip.endLocation,
        trip.startLatitude ?? null,
        trip.startLongitude ?? null,
        trip.endLatitude ?? null,
        trip.endLongitude ?? null,
        trip.distance,
        trip.startTime,
        trip.endTime,
        trip.purpose,
        trip.notes ?? null,
        now,
        now,
      ]
    );

    // Update vehicle mileage
    try {
      const activeVehicle = await getActiveVehicle();
      if (activeVehicle) {
        await updateVehicleMileage(activeVehicle.id, trip.distance);
      }
    } catch (vehicleError) {
      // Don't fail trip creation if vehicle update fails
      console.error('Error updating vehicle mileage:', vehicleError);
    }

    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error creating trip:', error);
    throw new Error('Failed to save trip to database');
  }
}

export async function getAllTrips(): Promise<Trip[]> {
  try {
    const db = getDatabase();
    const trips = await db.getAllAsync<Trip>(
      'SELECT * FROM trips ORDER BY startTime DESC'
    );
    return trips;
  } catch (error) {
    console.error('Error getting all trips:', error);
    throw new Error('Failed to retrieve trips from database');
  }
}

export async function getTripById(id: number): Promise<Trip | null> {
  const db = getDatabase();
  const trip = await db.getFirstAsync<Trip>(
    'SELECT * FROM trips WHERE id = ?',
    [id]
  );
  return trip ?? null;
}

export async function getTripsByPurpose(purpose: string): Promise<Trip[]> {
  const db = getDatabase();
  const trips = await db.getAllAsync<Trip>(
    'SELECT * FROM trips WHERE purpose = ? ORDER BY startTime DESC',
    [purpose]
  );
  return trips;
}

export async function getTripsByDateRange(startDate: number, endDate: number): Promise<Trip[]> {
  const db = getDatabase();
  const trips = await db.getAllAsync<Trip>(
    'SELECT * FROM trips WHERE startTime >= ? AND startTime <= ? ORDER BY startTime DESC',
    [startDate, endDate]
  );
  return trips;
}

export async function updateTrip(id: number, trip: Partial<Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const db = getDatabase();
  const now = Date.now();

  const fields: string[] = [];
  const values: any[] = [];

  if (trip.startLocation !== undefined) {
    fields.push('startLocation = ?');
    values.push(trip.startLocation);
  }
  if (trip.endLocation !== undefined) {
    fields.push('endLocation = ?');
    values.push(trip.endLocation);
  }
  if (trip.startLatitude !== undefined) {
    fields.push('startLatitude = ?');
    values.push(trip.startLatitude);
  }
  if (trip.startLongitude !== undefined) {
    fields.push('startLongitude = ?');
    values.push(trip.startLongitude);
  }
  if (trip.endLatitude !== undefined) {
    fields.push('endLatitude = ?');
    values.push(trip.endLatitude);
  }
  if (trip.endLongitude !== undefined) {
    fields.push('endLongitude = ?');
    values.push(trip.endLongitude);
  }
  if (trip.distance !== undefined) {
    fields.push('distance = ?');
    values.push(trip.distance);
  }
  if (trip.startTime !== undefined) {
    fields.push('startTime = ?');
    values.push(trip.startTime);
  }
  if (trip.endTime !== undefined) {
    fields.push('endTime = ?');
    values.push(trip.endTime);
  }
  if (trip.purpose !== undefined) {
    fields.push('purpose = ?');
    values.push(trip.purpose);
  }
  if (trip.notes !== undefined) {
    fields.push('notes = ?');
    values.push(trip.notes);
  }

  fields.push('updatedAt = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE trips SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteTrip(id: number): Promise<void> {
  if (!id || typeof id !== 'number' || id <= 0) {
    throw new Error('Invalid trip ID');
  }

  try {
    const db = getDatabase();
    const result = await db.runAsync('DELETE FROM trips WHERE id = ?', [id]);

    if (result.changes === 0) {
      throw new Error('Trip not found');
    }
  } catch (error) {
    console.error('Error deleting trip:', error);
    if (error instanceof Error && error.message === 'Trip not found') {
      throw error;
    }
    throw new Error('Failed to delete trip from database');
  }
}

export async function getTripStats(): Promise<{
  totalTrips: number;
  totalDistance: number;
  businessTrips: number;
  personalTrips: number;
  businessDistance: number;
  personalDistance: number;
}> {
  const db = getDatabase();

  const total = await db.getFirstAsync<{ count: number; distance: number }>(
    'SELECT COUNT(*) as count, COALESCE(SUM(distance), 0) as distance FROM trips'
  );

  const business = await db.getFirstAsync<{ count: number; distance: number }>(
    "SELECT COUNT(*) as count, COALESCE(SUM(distance), 0) as distance FROM trips WHERE purpose = 'business'"
  );

  const personal = await db.getFirstAsync<{ count: number; distance: number }>(
    "SELECT COUNT(*) as count, COALESCE(SUM(distance), 0) as distance FROM trips WHERE purpose = 'personal'"
  );

  return {
    totalTrips: total?.count ?? 0,
    totalDistance: total?.distance ?? 0,
    businessTrips: business?.count ?? 0,
    personalTrips: personal?.count ?? 0,
    businessDistance: business?.distance ?? 0,
    personalDistance: personal?.distance ?? 0,
  };
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
  const db = getDatabase();

  const startOfYear = new Date(year, 0, 1).getTime();
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

  const total = await db.getFirstAsync<{ count: number; distance: number }>(
    'SELECT COUNT(*) as count, COALESCE(SUM(distance), 0) as distance FROM trips WHERE startTime >= ? AND startTime <= ?',
    [startOfYear, endOfYear]
  );

  const business = await db.getFirstAsync<{ count: number; distance: number }>(
    "SELECT COUNT(*) as count, COALESCE(SUM(distance), 0) as distance FROM trips WHERE purpose = 'business' AND startTime >= ? AND startTime <= ?",
    [startOfYear, endOfYear]
  );

  const personal = await db.getFirstAsync<{ count: number; distance: number }>(
    "SELECT COUNT(*) as count, COALESCE(SUM(distance), 0) as distance FROM trips WHERE purpose = 'personal' AND startTime >= ? AND startTime <= ?",
    [startOfYear, endOfYear]
  );

  return {
    totalTrips: total?.count ?? 0,
    totalDistance: total?.distance ?? 0,
    businessTrips: business?.count ?? 0,
    personalTrips: personal?.count ?? 0,
    businessDistance: business?.distance ?? 0,
    personalDistance: personal?.distance ?? 0,
  };
}

export async function getMonthlyStats(year: number, month: number): Promise<{
  trips: number;
  distance: number;
  businessDistance: number;
}> {
  const db = getDatabase();

  const startOfMonth = new Date(year, month - 1, 1).getTime();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  const total = await db.getFirstAsync<{ count: number; distance: number }>(
    'SELECT COUNT(*) as count, COALESCE(SUM(distance), 0) as distance FROM trips WHERE startTime >= ? AND startTime <= ?',
    [startOfMonth, endOfMonth]
  );

  const business = await db.getFirstAsync<{ distance: number }>(
    "SELECT COALESCE(SUM(distance), 0) as distance FROM trips WHERE purpose = 'business' AND startTime >= ? AND startTime <= ?",
    [startOfMonth, endOfMonth]
  );

  return {
    trips: total?.count ?? 0,
    distance: total?.distance ?? 0,
    businessDistance: business?.distance ?? 0,
  };
}

/**
 * Calculate the total deductible value of business trips using year-specific rates
 */
export async function getBusinessDeductibleValue(): Promise<number> {
  const db = getDatabase();

  // Get all business trips grouped by year
  const trips = await db.getAllAsync<{
    year: string;
    distance: number;
  }>(
    `SELECT
      strftime('%Y', startTime / 1000, 'unixepoch') as year,
      COALESCE(SUM(distance), 0) as distance
    FROM trips
    WHERE purpose = 'business'
    GROUP BY year`
  );

  let totalValue = 0;

  // Calculate value for each year using the year-specific rate
  for (const trip of trips) {
    const year = parseInt(trip.year, 10);
    const rate = await getRateForYear(year);
    totalValue += trip.distance * rate;
  }

  return totalValue;
}

/**
 * Calculate the deductible value of business trips for a specific year
 */
export async function getBusinessDeductibleValueForYear(year: number): Promise<number> {
  const db = getDatabase();

  const startOfYear = new Date(year, 0, 1).getTime();
  const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

  // Get business trip distance for the specified year
  const result = await db.getFirstAsync<{ distance: number }>(
    `SELECT COALESCE(SUM(distance), 0) as distance
    FROM trips
    WHERE purpose = 'business'
    AND startTime >= ?
    AND startTime <= ?`,
    [startOfYear, endOfYear]
  );

  const distance = result?.distance ?? 0;
  const rate = await getRateForYear(year);

  return distance * rate;
}
