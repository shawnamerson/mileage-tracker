import { supabase } from './supabase';
import { getCurrentUser } from './authService';
import { getRateForYear } from './mileageRateService';
import { getActiveVehicle, updateVehicleMileage } from './vehicleService';

export interface Trip {
  id?: string; // UUID in Supabase
  user_id: string;
  start_location: string;
  end_location: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude: number;
  end_longitude: number;
  distance: number; // in miles
  start_time: number; // Unix timestamp in milliseconds
  end_time: number; // Unix timestamp in milliseconds
  purpose: 'business' | 'personal' | 'medical' | 'charity' | 'other';
  notes?: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
  deleted_at?: string;
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

export async function createTrip(
  trip: Omit<Trip, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Trip> {
  // Validate trip data
  validateTrip(trip);

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('No user logged in');
    }

    const { data, error } = await supabase
      .from('trips')
      .insert({
        user_id: user.id,
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
        notes: trip.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating trip:', error);
      throw new Error('Failed to save trip to database');
    }

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

    return data;
  } catch (error) {
    console.error('Error creating trip:', error);
    throw error;
  }
}

export async function getAllTrips(): Promise<Trip[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('No user logged in');
      return [];
    }

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error getting all trips:', error);
      throw new Error('Failed to retrieve trips from database');
    }

    return data || [];
  } catch (error) {
    console.error('Error getting all trips:', error);
    throw error;
  }
}

export async function getTripById(id: string): Promise<Trip | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('No user logged in');
      return null;
    }

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .single();

    if (error) {
      console.error('Error getting trip:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting trip:', error);
    return null;
  }
}

export async function getTripsByPurpose(purpose: string): Promise<Trip[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('No user logged in');
      return [];
    }

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user.id)
      .eq('purpose', purpose)
      .eq('is_deleted', false)
      .order('start_time', { ascending: false});

    if (error) {
      console.error('Error getting trips by purpose:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting trips by purpose:', error);
    return [];
  }
}

export async function getTripsByDateRange(startDate: number, endDate: number): Promise<Trip[]> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('No user logged in');
      return [];
    }

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .eq('is_deleted', false)
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Error getting trips by date range:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting trips by date range:', error);
    return [];
  }
}

export async function updateTrip(
  id: string,
  trip: Partial<Omit<Trip, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('No user logged in');
    }

    const { error } = await supabase
      .from('trips')
      .update(trip)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating trip:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error updating trip:', error);
    throw error;
  }
}

export async function deleteTrip(id: string): Promise<void> {
  if (!id) {
    throw new Error('Invalid trip ID');
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('No user logged in');
    }

    // Soft delete
    const { error } = await supabase
      .from('trips')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting trip:', error);
      throw new Error('Failed to delete trip from database');
    }
  } catch (error) {
    console.error('Error deleting trip:', error);
    throw error;
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
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        totalTrips: 0,
        totalDistance: 0,
        businessTrips: 0,
        personalTrips: 0,
        businessDistance: 0,
        personalDistance: 0,
      };
    }

    const { data: allTrips } = await supabase
      .from('trips')
      .select('distance, purpose')
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    const trips = allTrips || [];
    const businessTripsData = trips.filter((t) => t.purpose === 'business');
    const personalTripsData = trips.filter((t) => t.purpose === 'personal');

    return {
      totalTrips: trips.length,
      totalDistance: trips.reduce((sum, t) => sum + (t.distance || 0), 0),
      businessTrips: businessTripsData.length,
      personalTrips: personalTripsData.length,
      businessDistance: businessTripsData.reduce((sum, t) => sum + (t.distance || 0), 0),
      personalDistance: personalTripsData.reduce((sum, t) => sum + (t.distance || 0), 0),
    };
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
    const user = await getCurrentUser();
    if (!user) {
      return {
        totalTrips: 0,
        totalDistance: 0,
        businessTrips: 0,
        personalTrips: 0,
        businessDistance: 0,
        personalDistance: 0,
      };
    }

    const startOfYear = new Date(year, 0, 1).getTime();
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

    const { data: allTrips } = await supabase
      .from('trips')
      .select('distance, purpose')
      .eq('user_id', user.id)
      .gte('start_time', startOfYear)
      .lte('start_time', endOfYear)
      .eq('is_deleted', false);

    const trips = allTrips || [];
    const businessTripsData = trips.filter((t) => t.purpose === 'business');
    const personalTripsData = trips.filter((t) => t.purpose === 'personal');

    return {
      totalTrips: trips.length,
      totalDistance: trips.reduce((sum, t) => sum + (t.distance || 0), 0),
      businessTrips: businessTripsData.length,
      personalTrips: personalTripsData.length,
      businessDistance: businessTripsData.reduce((sum, t) => sum + (t.distance || 0), 0),
      personalDistance: personalTripsData.reduce((sum, t) => sum + (t.distance || 0), 0),
    };
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

export async function getMonthlyStats(
  year: number,
  month: number
): Promise<{
  trips: number;
  distance: number;
  businessDistance: number;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { trips: 0, distance: 0, businessDistance: 0 };
    }

    const startOfMonth = new Date(year, month - 1, 1).getTime();
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const { data: allTrips } = await supabase
      .from('trips')
      .select('distance, purpose')
      .eq('user_id', user.id)
      .gte('start_time', startOfMonth)
      .lte('start_time', endOfMonth)
      .eq('is_deleted', false);

    const trips = allTrips || [];
    const businessTripsData = trips.filter((t) => t.purpose === 'business');

    return {
      trips: trips.length,
      distance: trips.reduce((sum, t) => sum + (t.distance || 0), 0),
      businessDistance: businessTripsData.reduce((sum, t) => sum + (t.distance || 0), 0),
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
    const user = await getCurrentUser();
    if (!user) {
      return 0;
    }

    const { data: trips } = await supabase
      .from('trips')
      .select('start_time, distance')
      .eq('user_id', user.id)
      .eq('purpose', 'business')
      .eq('is_deleted', false);

    if (!trips || trips.length === 0) {
      return 0;
    }

    // Group by year and calculate
    const yearTotals = new Map<number, number>();
    trips.forEach((trip) => {
      const year = new Date(trip.start_time).getFullYear();
      yearTotals.set(year, (yearTotals.get(year) || 0) + trip.distance);
    });

    let totalValue = 0;
    for (const [year, distance] of yearTotals) {
      const rate = await getRateForYear(year);
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
    const user = await getCurrentUser();
    if (!user) {
      return 0;
    }

    const startOfYear = new Date(year, 0, 1).getTime();
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

    const { data: trips } = await supabase
      .from('trips')
      .select('distance')
      .eq('user_id', user.id)
      .eq('purpose', 'business')
      .gte('start_time', startOfYear)
      .lte('start_time', endOfYear)
      .eq('is_deleted', false);

    const distance = (trips || []).reduce((sum, t) => sum + (t.distance || 0), 0);
    const rate = await getRateForYear(year);

    return distance * rate;
  } catch (error) {
    console.error('Error calculating business deductible value for year:', error);
    return 0;
  }
}
