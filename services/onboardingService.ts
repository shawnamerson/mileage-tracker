import { getAllVehicles } from './vehicleService';
import { getCurrentUser } from './authService';

// Cache for onboarding check to avoid repeated slow checks
let onboardingCache: { result: boolean; timestamp: number; userId: string } | null = null;
const ONBOARDING_CACHE_DURATION = 30000; // 30 seconds

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
 *
 * Caches result for 30 seconds to prevent blocking navigation
 */
export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    // Check if user is authenticated first
    const user = await getCurrentUser();
    if (!user) {
      console.log('[Onboarding] No user logged in');
      return false;
    }

    // Check cache first to avoid repeated checks during navigation
    if (
      onboardingCache &&
      onboardingCache.userId === user.id &&
      Date.now() - onboardingCache.timestamp < ONBOARDING_CACHE_DURATION
    ) {
      console.log('[Onboarding] Using cached result:', onboardingCache.result);
      return onboardingCache.result;
    }

    // Database is the source of truth: user has vehicles = onboarding complete
    const vehicles = await getAllVehicles();
    const hasVehicles = vehicles.length > 0;

    if (!hasVehicles) {
      console.log('[Onboarding] No vehicles found for user. Showing onboarding.');
    }

    // Cache the result
    onboardingCache = {
      result: hasVehicles,
      timestamp: Date.now(),
      userId: user.id,
    };

    return hasVehicles;
  } catch (error) {
    console.error('[Onboarding] Error checking status:', error);
    // On error (e.g., network issues), assume not completed to be safe
    // This ensures users can still complete onboarding if there's a connectivity issue
    return false;
  }
}

/**
 * Clear the onboarding cache (call after vehicle creation)
 */
export function clearOnboardingCache(): void {
  onboardingCache = null;
  console.log('[Onboarding] Cache cleared');
}

/**
 * Mark onboarding as completed
 *
 * No-op function kept for API compatibility.
 * Onboarding is automatically "complete" when user creates their first vehicle.
 */
export async function completeOnboarding(): Promise<void> {
  // Clear cache so UI updates immediately
  clearOnboardingCache();
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
