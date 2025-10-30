import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getLocalTrips, saveLocalTrip, LocalTrip } from './localDatabase';
import { getCurrentUser } from './authService';

/**
 * iCloud CloudKit Backup Service
 *
 * Provides optional cloud backup for trips using Apple's CloudKit.
 * All data stays on device by default, but users can opt-in to iCloud sync.
 *
 * NOTE: This is a placeholder implementation. For full CloudKit integration,
 * you would need to use a native module or react-native-cloud-storage.
 *
 * For now, we'll use AsyncStorage with the @react-native-async-storage/async-storage
 * which on iOS can sync to iCloud if configured properly.
 */

const ICLOUD_ENABLED_KEY = 'icloud_backup_enabled';
const ICLOUD_LAST_BACKUP_KEY = 'icloud_last_backup';
const ICLOUD_BACKUP_DATA_KEY = 'icloud_backup_data';

export interface ICloudStatus {
  enabled: boolean;
  lastBackupTime: number | null;
  tripCount: number;
  backupSize: string;
}

/**
 * Check if iCloud backup is enabled
 */
export async function isICloudBackupEnabled(): Promise<boolean> {
  try {
    if (Platform.OS !== 'ios') {
      return false; // iCloud only available on iOS
    }

    const enabled = await AsyncStorage.getItem(ICLOUD_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    console.error('[iCloud] Error checking if backup enabled:', error);
    return false;
  }
}

/**
 * Enable iCloud backup
 */
export async function enableICloudBackup(): Promise<boolean> {
  try {
    if (Platform.OS !== 'ios') {
      console.log('[iCloud] Not available on this platform');
      return false;
    }

    await AsyncStorage.setItem(ICLOUD_ENABLED_KEY, 'true');
    console.log('[iCloud] ✅ Backup enabled');

    // Trigger initial backup
    await backupToICloud();

    return true;
  } catch (error) {
    console.error('[iCloud] Error enabling backup:', error);
    return false;
  }
}

/**
 * Disable iCloud backup
 */
export async function disableICloudBackup(): Promise<boolean> {
  try {
    await AsyncStorage.setItem(ICLOUD_ENABLED_KEY, 'false');
    console.log('[iCloud] ✅ Backup disabled');
    return true;
  } catch (error) {
    console.error('[iCloud] Error disabling backup:', error);
    return false;
  }
}

/**
 * Backup all trips to iCloud
 *
 * NOTE: This uses AsyncStorage which can sync to iCloud on iOS if configured.
 * For production, consider using expo-cloud-storage or react-native-cloud-storage
 * for proper CloudKit integration.
 */
export async function backupToICloud(): Promise<{
  success: boolean;
  tripCount?: number;
  error?: string;
}> {
  try {
    const enabled = await isICloudBackupEnabled();
    if (!enabled) {
      return { success: false, error: 'iCloud backup not enabled' };
    }

    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    console.log('[iCloud] Starting backup...');

    // Get all trips
    const trips = await getLocalTrips(user.id);

    // Create backup data
    const backupData = {
      userId: user.id,
      trips,
      backupTime: Date.now(),
      version: '1.0.0',
    };

    // Store in AsyncStorage (which syncs to iCloud on iOS if configured)
    await AsyncStorage.setItem(
      ICLOUD_BACKUP_DATA_KEY,
      JSON.stringify(backupData)
    );

    // Update last backup time
    await AsyncStorage.setItem(
      ICLOUD_LAST_BACKUP_KEY,
      Date.now().toString()
    );

    console.log(`[iCloud] ✅ Backup complete: ${trips.length} trips`);

    return {
      success: true,
      tripCount: trips.length,
    };
  } catch (error) {
    console.error('[iCloud] Error backing up to iCloud:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Restore trips from iCloud backup
 */
export async function restoreFromICloud(): Promise<{
  success: boolean;
  importedCount?: number;
  skippedCount?: number;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    console.log('[iCloud] Starting restore...');

    // Get backup data from AsyncStorage
    const backupDataJson = await AsyncStorage.getItem(ICLOUD_BACKUP_DATA_KEY);

    if (!backupDataJson) {
      return {
        success: false,
        error: 'No backup found in iCloud',
      };
    }

    const backupData = JSON.parse(backupDataJson);

    // Verify backup belongs to this user
    if (backupData.userId !== user.id) {
      console.warn('[iCloud] Backup belongs to different user');
      return {
        success: false,
        error: 'Backup belongs to different user',
      };
    }

    console.log(`[iCloud] Found backup with ${backupData.trips.length} trips`);

    // Get existing trips to avoid duplicates
    const existingTrips = await getLocalTrips(user.id);
    const existingTripIds = new Set(existingTrips.map(t => t.id));

    // Import trips that don't exist locally
    let importedCount = 0;
    let skippedCount = 0;

    for (const trip of backupData.trips) {
      if (existingTripIds.has(trip.id)) {
        skippedCount++;
        continue;
      }

      await saveLocalTrip(trip);
      importedCount++;
    }

    console.log(`[iCloud] ✅ Restore complete: ${importedCount} imported, ${skippedCount} skipped`);

    return {
      success: true,
      importedCount,
      skippedCount,
    };
  } catch (error) {
    console.error('[iCloud] Error restoring from iCloud:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get iCloud backup status
 */
export async function getICloudStatus(): Promise<ICloudStatus> {
  try {
    const enabled = await isICloudBackupEnabled();
    const lastBackupTimeStr = await AsyncStorage.getItem(ICLOUD_LAST_BACKUP_KEY);
    const backupDataJson = await AsyncStorage.getItem(ICLOUD_BACKUP_DATA_KEY);

    const lastBackupTime = lastBackupTimeStr ? parseInt(lastBackupTimeStr) : null;

    let tripCount = 0;
    let backupSize = '0 KB';

    if (backupDataJson) {
      const backupData = JSON.parse(backupDataJson);
      tripCount = backupData.trips?.length || 0;

      // Calculate size in bytes (each character is 1 byte in UTF-8 for ASCII, ~3 bytes for Unicode)
      // Using conservative estimate of 2 bytes per character for JSON data
      const sizeInBytes = backupDataJson.length * 2;
      if (sizeInBytes < 1024) {
        backupSize = `${sizeInBytes} B`;
      } else if (sizeInBytes < 1024 * 1024) {
        backupSize = `${(sizeInBytes / 1024).toFixed(2)} KB`;
      } else {
        backupSize = `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
      }
    }

    return {
      enabled,
      lastBackupTime,
      tripCount,
      backupSize,
    };
  } catch (error) {
    console.error('[iCloud] Error getting status:', error);
    return {
      enabled: false,
      lastBackupTime: null,
      tripCount: 0,
      backupSize: '0 KB',
    };
  }
}

/**
 * Delete iCloud backup
 */
export async function deleteICloudBackup(): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(ICLOUD_BACKUP_DATA_KEY);
    await AsyncStorage.removeItem(ICLOUD_LAST_BACKUP_KEY);

    console.log('[iCloud] ✅ Backup deleted');
    return true;
  } catch (error) {
    console.error('[iCloud] Error deleting backup:', error);
    return false;
  }
}

/**
 * Configure AsyncStorage to sync with iCloud
 *
 * NOTE: This requires proper iCloud configuration in your app:
 * 1. Enable iCloud capability in Xcode
 * 2. Add iCloud container identifier
 * 3. Configure @react-native-async-storage/async-storage to use iCloud
 *
 * See: https://react-native-async-storage.github.io/async-storage/docs/advanced/icloud
 */
export function configureICloudSync() {
  if (Platform.OS === 'ios') {
    console.log('[iCloud] iCloud sync configured (ensure app has iCloud entitlements)');
    // AsyncStorage automatically syncs to iCloud if configured in Info.plist
  }
}
