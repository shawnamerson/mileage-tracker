import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

// Local user types (offline-first, no authentication required)
export interface LocalUser {
  id: string;
  email: string;
  created_at: string;
}

export interface LocalProfile {
  id: string;
  email: string;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_status: 'trial' | 'active' | 'inactive' | 'expired';
  subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// AsyncStorage keys
const USER_KEY = 'user';
const USER_ID_KEY = 'user_id';
const USER_EMAIL_KEY = 'user_email';
const PROFILE_KEY = 'profile';

/**
 * Initialize user on first app launch
 * Automatically creates an anonymous user with unique device ID
 */
export async function initializeUser(): Promise<LocalUser> {
  try {
    // Check if user already exists
    let user = await getCurrentUser();

    if (user) {
      console.log('[Auth] User already exists:', user.email);
      return user;
    }

    // Create new anonymous user
    console.log('[Auth] Creating new anonymous user...');
    const userId = uuidv4();
    const email = `user_${userId.split('-')[0]}@local`;

    user = {
      id: userId,
      email,
      created_at: new Date().toISOString(),
    };

    // Store user data locally
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    await AsyncStorage.setItem(USER_ID_KEY, userId);
    await AsyncStorage.setItem(USER_EMAIL_KEY, email);

    // Create profile with 7-day trial
    await createLocalProfile(user);

    console.log('[Auth] ✅ Anonymous user created:', email);
    return user;
  } catch (error) {
    console.error('[Auth] Error initializing user:', error);
    throw error;
  }
}

/**
 * Create a new local profile for a user
 */
async function createLocalProfile(user: LocalUser): Promise<LocalProfile> {
  const now = new Date();
  const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  const profile: LocalProfile = {
    id: user.id,
    email: user.email,
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
    subscription_status: 'trial',
    subscription_expires_at: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  console.log('[Auth] ✅ Profile created with 7-day trial');

  return profile;
}

/**
 * Get local profile from AsyncStorage
 */
async function getLocalProfile(userId: string): Promise<LocalProfile | null> {
  try {
    const profileJson = await AsyncStorage.getItem(PROFILE_KEY);
    if (!profileJson) {
      return null;
    }

    const profile: LocalProfile = JSON.parse(profileJson);

    // Verify it belongs to this user
    if (profile.id !== userId) {
      console.warn('[Auth] Profile belongs to different user, clearing...');
      await AsyncStorage.removeItem(PROFILE_KEY);
      return null;
    }

    return profile;
  } catch (error) {
    console.error('[Auth] Error getting local profile:', error);
    return null;
  }
}

/**
 * Reset app data (clear all user data and start fresh)
 */
export async function resetAppData(): Promise<{ error: Error | null }> {
  try {
    console.log('[Auth] Resetting app data...');

    // Clear all auth data
    await AsyncStorage.multiRemove([
      USER_KEY,
      USER_ID_KEY,
      USER_EMAIL_KEY,
      PROFILE_KEY,
    ]);

    console.log('[Auth] ✅ App data reset successfully');
    return { error: null };
  } catch (error) {
    console.error('[Auth] Reset error:', error);
    return { error: error instanceof Error ? error : new Error('Reset failed') };
  }
}

/**
 * Get the current user from local storage
 */
export async function getCurrentUser(): Promise<LocalUser | null> {
  try {
    const userJson = await AsyncStorage.getItem(USER_KEY);
    if (!userJson) {
      return null;
    }

    const user: LocalUser = JSON.parse(userJson);
    return user;
  } catch (error) {
    console.error('[Auth] Error getting current user:', error);
    return null;
  }
}

/**
 * Get the current user's profile
 */
export async function getUserProfile(userId: string): Promise<LocalProfile | null> {
  return await getLocalProfile(userId);
}

/**
 * Update user profile (for subscription changes)
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Omit<LocalProfile, 'id' | 'email' | 'created_at'>>
): Promise<LocalProfile | null> {
  try {
    const profile = await getLocalProfile(userId);
    if (!profile) {
      console.error('[Auth] Cannot update profile - profile not found');
      return null;
    }

    const updatedProfile: LocalProfile = {
      ...profile,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
    console.log('[Auth] ✅ Profile updated');

    return updatedProfile;
  } catch (error) {
    console.error('[Auth] Error updating profile:', error);
    return null;
  }
}

/**
 * Check if user's trial has expired
 */
export function isTrialExpired(profile: LocalProfile): boolean {
  const now = new Date();
  const trialEnds = new Date(profile.trial_ends_at);
  return now > trialEnds;
}

/**
 * Check if user has active subscription (trial or paid)
 */
export function hasActiveSubscription(profile: LocalProfile): boolean {
  // If in trial and not expired
  if (profile.subscription_status === 'trial') {
    return !isTrialExpired(profile);
  }

  // If has active subscription that hasn't expired
  if (profile.subscription_status === 'active') {
    if (!profile.subscription_expires_at) {
      return true; // Lifetime or no expiration
    }
    const now = new Date();
    const expiresAt = new Date(profile.subscription_expires_at);
    return now <= expiresAt;
  }

  return false;
}

/**
 * Get days remaining in trial
 */
export function getTrialDaysRemaining(profile: LocalProfile): number {
  const now = new Date();
  const trialEnds = new Date(profile.trial_ends_at);
  const diffTime = trialEnds.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Activate subscription (called after successful Apple IAP purchase)
 */
export async function activateSubscription(
  userId: string,
  expiresAt: string | null = null
): Promise<boolean> {
  try {
    const updatedProfile = await updateUserProfile(userId, {
      subscription_status: 'active',
      subscription_expires_at: expiresAt,
    });

    return !!updatedProfile;
  } catch (error) {
    console.error('[Auth] Error activating subscription:', error);
    return false;
  }
}

/**
 * Deactivate subscription (for testing or cancellation)
 */
export async function deactivateSubscription(userId: string): Promise<boolean> {
  try {
    const updatedProfile = await updateUserProfile(userId, {
      subscription_status: 'expired',
      subscription_expires_at: new Date().toISOString(),
    });

    return !!updatedProfile;
  } catch (error) {
    console.error('[Auth] Error deactivating subscription:', error);
    return false;
  }
}

/**
 * Check if user is initialized
 */
export async function isUserInitialized(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Get current user ID (helper function)
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}

// Re-export Profile type for backward compatibility
export type Profile = LocalProfile;
