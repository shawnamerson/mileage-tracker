import { getDatabase, MileageRate } from './database';

/**
 * Get the mileage rate for a specific year
 */
export async function getRateForYear(year: number): Promise<number> {
  const db = getDatabase();
  const result = await db.getFirstAsync<{ rate: number }>(
    'SELECT rate FROM mileage_rates WHERE year = ?',
    [year]
  );

  // If no rate found for the year, return a default rate of 0.70
  return result?.rate ?? 0.70;
}

/**
 * Get all mileage rates, ordered by year descending
 */
export async function getAllRates(): Promise<MileageRate[]> {
  const db = getDatabase();
  const result = await db.getAllAsync<MileageRate>(
    'SELECT * FROM mileage_rates ORDER BY year DESC'
  );
  return result;
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

  const db = getDatabase();
  const now = Date.now();

  // Check if rate exists for this year
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM mileage_rates WHERE year = ?',
    [year]
  );

  if (existing) {
    // Update existing rate
    await db.runAsync(
      'UPDATE mileage_rates SET rate = ?, updatedAt = ? WHERE year = ?',
      [rate, now, year]
    );
  } else {
    // Insert new rate
    await db.runAsync(
      'INSERT INTO mileage_rates (year, rate, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
      [year, rate, now, now]
    );
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
  const db = getDatabase();
  await db.runAsync('DELETE FROM mileage_rates WHERE year = ?', [year]);
}
