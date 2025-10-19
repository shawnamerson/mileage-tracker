import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllTrips, createTrip } from './tripService';
import { Trip } from './database';

const BACKUP_METADATA_KEY = '@mileage_tracker:backup_metadata';

export interface BackupMetadata {
  lastBackupDate: number;
  lastBackupSize: number;
  totalTrips: number;
  autoBackupEnabled: boolean;
}

/**
 * Creates a complete backup of all trip data
 */
export async function createBackup(): Promise<string> {
  try {
    const trips = await getAllTrips();

    const backup = {
      version: 1,
      exportDate: Date.now(),
      tripCount: trips.length,
      trips: trips,
    };

    const backupJson = JSON.stringify(backup, null, 2);
    const fileName = `mileage_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const file = new File(Paths.document, fileName);

    await file.write(backupJson);

    // Update backup metadata
    const metadata: BackupMetadata = {
      lastBackupDate: Date.now(),
      lastBackupSize: backupJson.length,
      totalTrips: trips.length,
      autoBackupEnabled: await isAutoBackupEnabled(),
    };

    await AsyncStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));

    return file.uri;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw new Error('Failed to create backup');
  }
}

/**
 * Shares the backup file with the user
 */
export async function shareBackup(): Promise<boolean> {
  try {
    const fileUri = await createBackup();

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Backup Mileage Data',
      });
      return true;
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (error) {
    console.error('Error sharing backup:', error);
    throw error;
  }
}

/**
 * Validates backup file format
 */
function validateBackup(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  if (!data.version || !data.exportDate || !data.trips) {
    return false;
  }

  if (!Array.isArray(data.trips)) {
    return false;
  }

  // Validate first trip to ensure it has required fields
  if (data.trips.length > 0) {
    const firstTrip = data.trips[0];
    const requiredFields = ['startLocation', 'endLocation', 'distance', 'startTime', 'endTime', 'purpose'];

    for (const field of requiredFields) {
      if (!(field in firstTrip)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Restores trips from a backup file
 */
export async function restoreFromBackup(fileUri: string, mode: 'merge' | 'replace' = 'merge'): Promise<number> {
  try {
    // Read backup file
    const file = new File(fileUri);
    const fileContent = await file.text();

    const backup = JSON.parse(fileContent);

    // Validate backup format
    if (!validateBackup(backup)) {
      throw new Error('Invalid backup file format');
    }

    const trips: Trip[] = backup.trips;

    if (mode === 'replace') {
      // In replace mode, we would need to clear existing trips first
      // For safety, we'll only support merge mode for now
      console.warn('Replace mode not yet implemented, using merge mode');
    }

    // Get existing trip IDs to avoid duplicates (based on timestamp and location)
    const existingTrips = await getAllTrips();
    const existingTripKeys = new Set(
      existingTrips.map((t) => `${t.startTime}_${t.endTime}_${t.startLocation}_${t.endLocation}`)
    );

    let importedCount = 0;

    // Import trips that don't already exist
    for (const trip of trips) {
      const tripKey = `${trip.startTime}_${trip.endTime}_${trip.startLocation}_${trip.endLocation}`;

      if (!existingTripKeys.has(tripKey)) {
        await createTrip({
          startLocation: trip.startLocation,
          endLocation: trip.endLocation,
          startLatitude: trip.startLatitude,
          startLongitude: trip.startLongitude,
          endLatitude: trip.endLatitude,
          endLongitude: trip.endLongitude,
          distance: trip.distance,
          startTime: trip.startTime,
          endTime: trip.endTime,
          purpose: trip.purpose,
          notes: trip.notes,
        });
        importedCount++;
      }
    }

    return importedCount;
  } catch (error) {
    console.error('Error restoring from backup:', error);
    throw new Error('Failed to restore from backup');
  }
}

/**
 * Gets backup metadata
 */
export async function getBackupMetadata(): Promise<BackupMetadata | null> {
  try {
    const metadataJson = await AsyncStorage.getItem(BACKUP_METADATA_KEY);
    if (!metadataJson) {
      return null;
    }
    return JSON.parse(metadataJson);
  } catch (error) {
    console.error('Error getting backup metadata:', error);
    return null;
  }
}

/**
 * Enables or disables auto-backup
 */
export async function setAutoBackup(enabled: boolean): Promise<void> {
  try {
    const metadata = (await getBackupMetadata()) || {
      lastBackupDate: 0,
      lastBackupSize: 0,
      totalTrips: 0,
      autoBackupEnabled: false,
    };

    metadata.autoBackupEnabled = enabled;
    await AsyncStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('Error setting auto-backup:', error);
    throw error;
  }
}

/**
 * Checks if auto-backup is enabled
 */
export async function isAutoBackupEnabled(): Promise<boolean> {
  try {
    const metadata = await getBackupMetadata();
    return metadata?.autoBackupEnabled ?? false;
  } catch (error) {
    console.error('Error checking auto-backup status:', error);
    return false;
  }
}

/**
 * Checks if a backup is needed (e.g., if it's been more than 7 days)
 */
export async function shouldBackup(): Promise<boolean> {
  try {
    const autoBackupEnabled = await isAutoBackupEnabled();
    if (!autoBackupEnabled) {
      return false;
    }

    const metadata = await getBackupMetadata();
    if (!metadata) {
      return true; // No backup exists yet
    }

    const daysSinceBackup = (Date.now() - metadata.lastBackupDate) / (1000 * 60 * 60 * 24);
    return daysSinceBackup >= 7;
  } catch (error) {
    console.error('Error checking if backup needed:', error);
    return false;
  }
}

/**
 * Performs automatic backup if needed
 */
export async function performAutoBackup(): Promise<boolean> {
  try {
    if (!(await shouldBackup())) {
      return false;
    }

    await createBackup();
    console.log('Auto-backup completed successfully');
    return true;
  } catch (error) {
    console.error('Error performing auto-backup:', error);
    return false;
  }
}

/**
 * Checks if user has never created a backup
 */
export async function hasNeverBackedUp(): Promise<boolean> {
  try {
    const metadata = await getBackupMetadata();
    return metadata === null || metadata.lastBackupDate === 0;
  } catch (error) {
    console.error('Error checking backup status:', error);
    return true; // Assume no backup to be safe
  }
}

/**
 * Checks if backup is recommended (after 10+ trips or 30+ days since last backup)
 */
export async function isBackupRecommended(): Promise<boolean> {
  try {
    const metadata = await getBackupMetadata();
    const trips = await getAllTrips();

    // If never backed up and have trips, recommend backup
    if (!metadata && trips.length > 0) {
      return true;
    }

    if (!metadata) {
      return false;
    }

    // Recommend backup if 30+ days since last backup
    const daysSinceBackup = (Date.now() - metadata.lastBackupDate) / (1000 * 60 * 60 * 24);
    if (daysSinceBackup >= 30) {
      return true;
    }

    // Recommend backup if 10+ new trips since last backup
    if (trips.length - metadata.totalTrips >= 10) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking if backup recommended:', error);
    return false;
  }
}

/**
 * Gets human-readable backup status message
 */
export async function getBackupStatusMessage(): Promise<string> {
  try {
    const metadata = await getBackupMetadata();

    if (!metadata || metadata.lastBackupDate === 0) {
      return 'No backup created yet';
    }

    const daysSinceBackup = Math.floor((Date.now() - metadata.lastBackupDate) / (1000 * 60 * 60 * 24));

    if (daysSinceBackup === 0) {
      return 'Backed up today';
    } else if (daysSinceBackup === 1) {
      return 'Backed up yesterday';
    } else if (daysSinceBackup < 7) {
      return `Backed up ${daysSinceBackup} days ago`;
    } else if (daysSinceBackup < 30) {
      const weeks = Math.floor(daysSinceBackup / 7);
      return `Backed up ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    } else {
      const months = Math.floor(daysSinceBackup / 30);
      return `Backed up ${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
  } catch (error) {
    console.error('Error getting backup status message:', error);
    return 'Unknown';
  }
}
