import { supabase } from './supabase';

export interface MileageRate {
  id?: string;
  year: number;
  rate: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get the mileage rate for a specific year
 */
export async function getRateForYear(year: number): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('mileage_rates')
      .select('rate')
      .eq('year', year)
      .single();

    if (error) {
      console.error('[Mileage Rates] Error fetching rate for year:', error);
      // If no rate found for the year, return a default rate of 0.70
      return 0.70;
    }

    return data?.rate ?? 0.70;
  } catch (error) {
    console.error('[Mileage Rates] Error in getRateForYear:', error);
    return 0.70;
  }
}

/**
 * Get all mileage rates, ordered by year descending
 */
export async function getAllRates(): Promise<MileageRate[]> {
  try {
    const { data, error } = await supabase
      .from('mileage_rates')
      .select('*')
      .order('year', { ascending: false });

    if (error) {
      console.error('[Mileage Rates] Error fetching all rates:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Mileage Rates] Error in getAllRates:', error);
    return [];
  }
}

/**
 * Set or update the mileage rate for a specific year
 */
export async function setRateForYear(year: number, rate: number): Promise<void> {
  if (year < 2000 || year > 2100) {
    throw new Error('Invalid year');
  }

  if (rate < 0 || rate > 10) {
    throw new Error('Invalid rate (must be between $0.00 and $10.00)');
  }

  try {
    // Use upsert to insert or update
    const { error } = await supabase
      .from('mileage_rates')
      .upsert({
        year,
        rate,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'year',
      });

    if (error) {
      console.error('[Mileage Rates] Error setting rate for year:', error);
      throw new Error('Failed to save mileage rate');
    }

    console.log(`[Mileage Rates] ✅ Set rate for ${year}: $${rate.toFixed(3)}`);
  } catch (error) {
    console.error('[Mileage Rates] Error in setRateForYear:', error);
    throw error;
  }
}

/**
 * Get mileage rates grouped by year (used for calculations)
 */
export async function getRatesByYear(): Promise<Map<number, number>> {
  const rates = await getAllRates();
  const rateMap = new Map<number, number>();

  rates.forEach(rate => {
    rateMap.set(rate.year, rate.rate);
  });

  return rateMap;
}

/**
 * Delete a mileage rate for a specific year
 */
export async function deleteRateForYear(year: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('mileage_rates')
      .delete()
      .eq('year', year);

    if (error) {
      console.error('[Mileage Rates] Error deleting rate for year:', error);
      throw new Error('Failed to delete mileage rate');
    }

    console.log(`[Mileage Rates] ✅ Deleted rate for ${year}`);
  } catch (error) {
    console.error('[Mileage Rates] Error in deleteRateForYear:', error);
    throw error;
  }
}
