import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';
const ONBOARDING_VERSION_KEY = 'onboarding_version';

// Increment this when you want to show onboarding again (e.g., for new features)
const CURRENT_ONBOARDING_VERSION = 1;

/**
 * Check if onboarding has been completed
 */
export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
    const version = await AsyncStorage.getItem(ONBOARDING_VERSION_KEY);

    // If never completed, return false
    if (!completed || completed !== 'true') {
      return false;
    }

    // If version doesn't match, return false (re-show onboarding for updates)
    const savedVersion = version ? parseInt(version, 10) : 0;
    return savedVersion >= CURRENT_ONBOARDING_VERSION;
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
}

/**
 * Mark onboarding as completed
 */
export async function completeOnboarding(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    await AsyncStorage.setItem(
      ONBOARDING_VERSION_KEY,
      CURRENT_ONBOARDING_VERSION.toString()
    );
  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw error;
  }
}

/**
 * Reset onboarding (for testing or re-showing)
 */
export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    await AsyncStorage.removeItem(ONBOARDING_VERSION_KEY);
  } catch (error) {
    console.error('Error resetting onboarding:', error);
    throw error;
  }
}
