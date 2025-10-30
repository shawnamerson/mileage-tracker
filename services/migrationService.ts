import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllTrips, Trip } from './tripService';
import { saveLocalTrip, getLocalTrips, LocalTrip } from './localDatabase';
import { getCurrentUser } from './authService';

const MIGRATION_STATUS_KEY = 'migration_status';
const BACKUP_FILE_NAME = 'milemate_backup.json';

export interface MigrationStatus {
  lastExportDate: number | null;
  lastImportDate: number | null;
  exportedTripsCount: number;
  importedTripsCount: number;
  hasExportedFromSupabase: boolean;
  isComplete: boolean;
}

export interface BackupData {
  version: string;
  exportDate: number;
  userId: string;
  trips: Trip[];
}

/**
 * Get the current migration status
 */
export async function getMigrationStatus(): Promise<MigrationStatus> {
  try {
    const statusJson = await AsyncStorage.getItem(MIGRATION_STATUS_KEY);
    if (statusJson) {
      return JSON.parse(statusJson);
    }
  } catch (error) {
    console.error('[Migration] Error getting status:', error);
  }

  // Default status
  return {
    lastExportDate: null,
    lastImportDate: null,
    exportedTripsCount: 0,
    importedTripsCount: 0,
    hasExportedFromSupabase: false,
    isComplete: false,
  };
}

/**
 * Update migration status
 */
async function updateMigrationStatus(updates: Partial<MigrationStatus>): Promise<void> {
  try {
    const currentStatus = await getMigrationStatus();
    const newStatus = { ...currentStatus, ...updates };
    await AsyncStorage.setItem(MIGRATION_STATUS_KEY, JSON.stringify(newStatus));
  } catch (error) {
    console.error('[Migration] Error updating status:', error);
  }
}

/**
 * Get the backup file path in the Documents directory
 */
function getBackupFilePath(): string {
  return `${FileSystem.documentDirectory}${BACKUP_FILE_NAME}`;
}

/**
 * Export all trips from Supabase to a JSON backup file
 * This ensures we don't lose any data when transitioning to offline-first
 */
export async function exportSupabaseData(): Promise<{
  success: boolean;
  filePath?: string;
  tripCount?: number;
  error?: string;
}> {
  try {
    console.log('[Migration] Starting Supabase data export...');

    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    // Fetch all trips from Supabase
    console.log('[Migration] Fetching trips from Supabase...');
    const trips = await getAllTrips();
    console.log(`[Migration] Found ${trips.length} trips in Supabase`);

    // Create backup data
    const backupData: BackupData = {
      version: '1.0.0',
      exportDate: Date.now(),
      userId: user.id,
      trips,
    };

    // Save to file
    const filePath = getBackupFilePath();
    console.log(`[Migration] Saving backup to ${filePath}...`);
    await FileSystem.writeAsStringAsync(
      filePath,
      JSON.stringify(backupData, null, 2)
    );

    // Update migration status
    await updateMigrationStatus({
      lastExportDate: Date.now(),
      exportedTripsCount: trips.length,
      hasExportedFromSupabase: true,
    });

    console.log(`[Migration] ✅ Successfully exported ${trips.length} trips to ${filePath}`);
    return {
      success: true,
      filePath,
      tripCount: trips.length,
    };
  } catch (error) {
    console.error('[Migration] Error exporting data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Import trips from backup file to local SQLite database
 * Skips trips that already exist locally (by ID)
 */
export async function importBackupToLocal(): Promise<{
  success: boolean;
  importedCount?: number;
  skippedCount?: number;
  error?: string;
}> {
  try {
    console.log('[Migration] Starting backup import to local database...');

    // Check if backup file exists
    const filePath = getBackupFilePath();
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      return {
        success: false,
        error: 'No backup file found. Please export data first.',
      };
    }

    // Read backup file
    console.log('[Migration] Reading backup file...');
    const fileContent = await FileSystem.readAsStringAsync(filePath);
    const backupData: BackupData = JSON.parse(fileContent);

    console.log(`[Migration] Found ${backupData.trips.length} trips in backup`);

    // Get existing local trips to avoid duplicates
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    const existingTrips = await getLocalTrips(user.id);
    const existingTripIds = new Set(existingTrips.map(t => t.id));

    // Import trips that don't exist locally
    let importedCount = 0;
    let skippedCount = 0;

    for (const trip of backupData.trips) {
      // Skip trips without required fields
      if (!trip.id || !trip.user_id) {
        console.warn('[Migration] Skipping trip without id or user_id');
        skippedCount++;
        continue;
      }

      if (existingTripIds.has(trip.id)) {
        console.log(`[Migration] Skipping trip ${trip.id} (already exists locally)`);
        skippedCount++;
        continue;
      }

      // Convert Supabase trip to local trip format
      const localTrip: Omit<LocalTrip, 'created_at' | 'updated_at' | 'synced'> = {
        id: trip.id,
        user_id: trip.user_id,
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
      };

      await saveLocalTrip(localTrip);
      importedCount++;
    }

    // Update migration status
    await updateMigrationStatus({
      lastImportDate: Date.now(),
      importedTripsCount: importedCount,
      isComplete: true,
    });

    console.log(`[Migration] ✅ Import complete: ${importedCount} imported, ${skippedCount} skipped`);
    return {
      success: true,
      importedCount,
      skippedCount,
    };
  } catch (error) {
    console.error('[Migration] Error importing backup:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Export backup file to share (for manual transfer to another device)
 */
export async function getBackupFileForSharing(): Promise<string | null> {
  try {
    const filePath = getBackupFilePath();
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      console.log('[Migration] No backup file found');
      return null;
    }

    return filePath;
  } catch (error) {
    console.error('[Migration] Error getting backup file:', error);
    return null;
  }
}

/**
 * Import from a shared backup file (from another device)
 */
export async function importFromSharedFile(fileUri: string): Promise<{
  success: boolean;
  importedCount?: number;
  error?: string;
}> {
  try {
    console.log('[Migration] Importing from shared file:', fileUri);

    // Read the shared file
    const fileContent = await FileSystem.readAsStringAsync(fileUri);
    const backupData: BackupData = JSON.parse(fileContent);

    // Save to local backup location
    const localPath = getBackupFilePath();
    await FileSystem.writeAsStringAsync(localPath, fileContent);

    // Import to local database
    return await importBackupToLocal();
  } catch (error) {
    console.error('[Migration] Error importing from shared file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get backup file size in human-readable format
 */
export async function getBackupFileSize(): Promise<string | null> {
  try {
    const filePath = getBackupFilePath();
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      return null;
    }

    const sizeInBytes = fileInfo.size || 0;

    if (sizeInBytes < 1024) {
      return `${sizeInBytes} B`;
    } else if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  } catch (error) {
    console.error('[Migration] Error getting file size:', error);
    return null;
  }
}

/**
 * Delete the backup file
 */
export async function deleteBackupFile(): Promise<boolean> {
  try {
    const filePath = getBackupFilePath();
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
      console.log('[Migration] Backup file deleted');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Migration] Error deleting backup file:', error);
    return false;
  }
}

/**
 * Perform a complete migration: export from Supabase, import to local
 */
export async function performFullMigration(): Promise<{
  success: boolean;
  exportedCount?: number;
  importedCount?: number;
  error?: string;
}> {
  try {
    console.log('[Migration] Starting full migration...');

    // Step 1: Export from Supabase
    const exportResult = await exportSupabaseData();
    if (!exportResult.success) {
      return {
        success: false,
        error: `Export failed: ${exportResult.error}`,
      };
    }

    // Step 2: Import to local database
    const importResult = await importBackupToLocal();
    if (!importResult.success) {
      return {
        success: false,
        error: `Import failed: ${importResult.error}`,
      };
    }

    console.log('[Migration] ✅ Full migration complete');
    return {
      success: true,
      exportedCount: exportResult.tripCount,
      importedCount: importResult.importedCount,
    };
  } catch (error) {
    console.error('[Migration] Error during full migration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
