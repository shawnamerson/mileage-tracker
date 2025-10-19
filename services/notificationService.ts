import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from './database';

const NOTIFICATIONS_ENABLED_KEY = '@mileage_tracker:notifications_enabled';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('trip-completed', {
        name: 'Trip Completed',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Check if notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    console.error('Error checking notification settings:', error);
    return false;
  }
}

/**
 * Enable or disable notifications
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled.toString());

    if (enabled) {
      // Request permissions when enabling
      await requestNotificationPermissions();
    }
  } catch (error) {
    console.error('Error setting notification preference:', error);
    throw error;
  }
}

/**
 * Format purpose text for display
 */
function formatPurpose(purpose: string): string {
  return purpose.charAt(0).toUpperCase() + purpose.slice(1);
}

/**
 * Get emoji for trip purpose
 */
function getPurposeEmoji(purpose: string): string {
  switch (purpose) {
    case 'business':
      return '💼';
    case 'personal':
      return '🏠';
    case 'medical':
      return '🏥';
    case 'charity':
      return '❤️';
    default:
      return '🚗';
  }
}

/**
 * Send notification when trip is completed
 */
export async function sendTripCompletedNotification(trip: Trip): Promise<void> {
  try {
    const enabled = await areNotificationsEnabled();
    if (!enabled) {
      return;
    }

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return;
    }

    const emoji = getPurposeEmoji(trip.purpose);
    const purposeText = formatPurpose(trip.purpose);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} Trip Recorded`,
        body: `${trip.distance.toFixed(1)} mi • ${purposeText}\n${trip.startLocation} → ${trip.endLocation}`,
        data: {
          tripId: trip.id,
          purpose: trip.purpose,
          distance: trip.distance,
        },
        sound: true,
        categoryIdentifier: 'TRIP_COMPLETED',
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Error sending trip notification:', error);
  }
}

/**
 * Set up notification categories with actions
 * Note: Interactive notifications are iOS only. Android will just open the app.
 */
export async function setupNotificationCategories(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationCategoryAsync('TRIP_COMPLETED', [
        {
          identifier: 'CHANGE_PURPOSE',
          buttonTitle: 'Change Purpose',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'DELETE_TRIP',
          buttonTitle: 'Delete',
          options: {
            opensAppToForeground: false,
            isDestructive: true,
          },
        },
      ]);
    }
  } catch (error) {
    console.error('Error setting up notification categories:', error);
  }
}

/**
 * Initialize notification service
 */
export async function initializeNotifications(): Promise<void> {
  try {
    await setupNotificationCategories();
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}
