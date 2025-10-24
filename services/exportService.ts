import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Trip } from './tripService';

export interface ExportOptions {
  format: 'csv' | 'json';
  dateRange?: {
    start: number;
    end: number;
  };
  purpose?: string[];
}

/**
 * Escapes CSV field values to handle commas, quotes, and newlines
 */
function escapeCSVField(field: string | number | null | undefined): string {
  if (field === null || field === undefined) {
    return '';
  }

  const stringField = String(field);

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }

  return stringField;
}

/**
 * Converts trips array to CSV format
 */
function tripsToCSV(trips: Trip[]): string {
  const headers = [
    'ID',
    'Date',
    'Start Time',
    'End Time',
    'Start Location',
    'End Location',
    'Distance (miles)',
    'Duration (minutes)',
    'Purpose',
    'Notes',
    'Start Latitude',
    'Start Longitude',
    'End Latitude',
    'End Longitude',
  ];

  const csvRows = [headers.join(',')];

  for (const trip of trips) {
    const startDate = new Date(trip.start_time);
    const endDate = new Date(trip.end_time);
    const durationMinutes = Math.round((trip.end_time - trip.start_time) / 60000);

    const row = [
      trip.id || '',
      startDate.toLocaleDateString(),
      startDate.toLocaleTimeString(),
      endDate.toLocaleTimeString(),
      escapeCSVField(trip.start_location),
      escapeCSVField(trip.end_location),
      trip.distance.toFixed(2),
      durationMinutes,
      escapeCSVField(trip.purpose),
      escapeCSVField(trip.notes || ''),
      trip.start_latitude?.toFixed(6) || '',
      trip.start_longitude?.toFixed(6) || '',
      trip.end_latitude?.toFixed(6) || '',
      trip.end_longitude?.toFixed(6) || '',
    ];

    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Exports trips to CSV file and shares it
 */
export async function exportTripsToCSV(trips: Trip[]): Promise<boolean> {
  try {
    if (trips.length === 0) {
      throw new Error('No trips to export');
    }

    const csv = tripsToCSV(trips);
    const fileName = `mileage_export_${new Date().toISOString().split('T')[0]}.csv`;
    const file = new File(Paths.document, fileName);

    await file.write(csv);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Mileage Data',
        UTI: 'public.comma-separated-values-text',
      });
      return true;
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw error;
  }
}

/**
 * Exports trips to JSON file and shares it
 */
export async function exportTripsToJSON(trips: Trip[]): Promise<boolean> {
  try {
    if (trips.length === 0) {
      throw new Error('No trips to export');
    }

    const json = JSON.stringify(trips, null, 2);
    const fileName = `mileage_backup_${new Date().toISOString().split('T')[0]}.json`;
    const file = new File(Paths.document, fileName);

    await file.write(json);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Mileage Data',
      });
      return true;
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error exporting to JSON:', error);
    throw error;
  }
}

/**
 * Generates a summary report for tax purposes
 */
export function generateTaxSummary(trips: Trip[], year?: number): string {
  const targetYear = year || new Date().getFullYear();

  // Filter trips by year
  const yearTrips = trips.filter((trip) => {
    const tripYear = new Date(trip.start_time).getFullYear();
    return tripYear === targetYear;
  });

  // Calculate totals by purpose
  const businessTrips = yearTrips.filter((t) => t.purpose === 'business');
  const medicalTrips = yearTrips.filter((t) => t.purpose === 'medical');
  const charityTrips = yearTrips.filter((t) => t.purpose === 'charity');

  const businessMiles = businessTrips.reduce((sum, t) => sum + t.distance, 0);
  const medicalMiles = medicalTrips.reduce((sum, t) => sum + t.distance, 0);
  const charityMiles = charityTrips.reduce((sum, t) => sum + t.distance, 0);

  // IRS standard mileage rates (these should be updated annually)
  const rates = {
    business: 0.655, // 2023 rate - should be updated
    medical: 0.22,
    charity: 0.14,
  };

  const businessDeduction = businessMiles * rates.business;
  const medicalDeduction = medicalMiles * rates.medical;
  const charityDeduction = charityMiles * rates.charity;

  return `
Mileage Tax Summary for ${targetYear}
Generated: ${new Date().toLocaleDateString()}

BUSINESS
  Trips: ${businessTrips.length}
  Miles: ${businessMiles.toFixed(2)}
  Rate: $${rates.business}/mile
  Deduction: $${businessDeduction.toFixed(2)}

MEDICAL
  Trips: ${medicalTrips.length}
  Miles: ${medicalMiles.toFixed(2)}
  Rate: $${rates.medical}/mile
  Deduction: $${medicalDeduction.toFixed(2)}

CHARITY
  Trips: ${charityTrips.length}
  Miles: ${charityMiles.toFixed(2)}
  Rate: $${rates.charity}/mile
  Deduction: $${charityDeduction.toFixed(2)}

TOTAL DEDUCTION: $${(businessDeduction + medicalDeduction + charityDeduction).toFixed(2)}

Note: IRS mileage rates may change annually. Please verify current rates.
This is for reference only and not official tax advice.
  `.trim();
}

/**
 * Exports tax summary as text file
 */
export async function exportTaxSummary(trips: Trip[], year?: number): Promise<boolean> {
  try {
    const summary = generateTaxSummary(trips, year);
    const targetYear = year || new Date().getFullYear();
    const fileName = `tax_summary_${targetYear}.txt`;
    const file = new File(Paths.document, fileName);

    await file.write(summary);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/plain',
        dialogTitle: 'Tax Summary',
      });
      return true;
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error exporting tax summary:', error);
    throw error;
  }
}
