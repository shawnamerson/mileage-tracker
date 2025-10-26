export interface MileageRate {
  year: number;
  rate: number;
}

/**
 * Official IRS Standard Mileage Rates for Business Use
 * Source: https://www.irs.gov/tax-professionals/standard-mileage-rates
 *
 * These rates are hardcoded and apply to all users.
 * Update this table annually when IRS announces new rates (typically in December).
 */
const IRS_MILEAGE_RATES: Record<number, number> = {
  2025: 0.70,   // 70 cents per mile (announced Dec 2024)
  2024: 0.67,   // 67 cents per mile
  2023: 0.655,  // 65.5 cents per mile
  2022: 0.625,  // 62.5 cents per mile (rate increased mid-year from 58.5)
  2021: 0.56,   // 56 cents per mile
  2020: 0.575,  // 57.5 cents per mile
  2019: 0.58,   // 58 cents per mile
  2018: 0.545,  // 54.5 cents per mile
  2017: 0.535,  // 53.5 cents per mile
  2016: 0.54,   // 54 cents per mile
  2015: 0.575,  // 57.5 cents per mile
};

// Default rate for years not in the table
const DEFAULT_RATE = 0.67;

/**
 * Get the IRS standard mileage rate for a specific year
 * Returns the official IRS rate or a default if year not found
 */
export async function getRateForYear(year: number): Promise<number> {
  const rate = IRS_MILEAGE_RATES[year];

  if (rate === undefined) {
    console.log(`[Mileage Rates] No rate found for ${year}, using default rate: $${DEFAULT_RATE}`);
    return DEFAULT_RATE;
  }

  return rate;
}

/**
 * Get all available mileage rates, ordered by year descending
 */
export async function getAllRates(): Promise<MileageRate[]> {
  const rates = Object.entries(IRS_MILEAGE_RATES)
    .map(([year, rate]) => ({
      year: parseInt(year),
      rate,
    }))
    .sort((a, b) => b.year - a.year);

  return rates;
}

/**
 * Get mileage rates grouped by year (used for calculations)
 */
export async function getRatesByYear(): Promise<Map<number, number>> {
  const rateMap = new Map<number, number>();

  Object.entries(IRS_MILEAGE_RATES).forEach(([year, rate]) => {
    rateMap.set(parseInt(year), rate);
  });

  return rateMap;
}
