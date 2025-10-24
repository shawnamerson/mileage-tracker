import { getAllVehicles } from './vehicleService';
import { getCurrentUser } from './authService';

/**
 * Check if onboarding has been completed
 *
 * Uses Supabase as single source of truth:
 * - If user has at least one vehicle → onboarding complete
 * - If user has no vehicles → needs onboarding
 *
 * This approach:
 * - Works across devices (no local storage)
 * - Automatically handles account switching
 * - No sync issues between storage and database
 */
export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    // Check if user is authenticated first
    const user = await getCurrentUser();
    if (!user) {
      console.log('[Onboarding] No user logged in');
      return false;
    }

    // Database is the source of truth: user has vehicles = onboarding complete
    const vehicles = await getAllVehicles();
    const hasVehicles = vehicles.length > 0;

    if (!hasVehicles) {
      console.log('[Onboarding] No vehicles found for user. Showing onboarding.');
    }

    return hasVehicles;
  } catch (error) {
    console.error('[Onboarding] Error checking status:', error);
    // On error (e.g., network issues), assume not completed to be safe
    // This ensures users can still complete onboarding if there's a connectivity issue
    return false;
  }
}

/**
 * Mark onboarding as completed
 *
 * No-op function kept for API compatibility.
 * Onboarding is automatically "complete" when user creates their first vehicle.
 */
export async function completeOnboarding(): Promise<void> {
  // No action needed - vehicle creation in database marks onboarding as complete
  console.log('[Onboarding] Marked complete (vehicle created in database)');
}

/**
 * Reset onboarding (for testing)
 *
 * To reset onboarding, delete all vehicles for the user.
 * This function is kept for API compatibility but could be removed.
 */
export async function resetOnboarding(): Promise<void> {
  console.log('[Onboarding] Reset requested. Delete vehicles to reset onboarding.');
  // No action needed - deleting vehicles will automatically trigger onboarding
}
