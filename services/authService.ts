import { supabase, Profile } from './supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

/**
 * Check if Apple Authentication is available on this device
 */
export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (error) {
    console.error('Error checking Apple Auth availability:', error);
    return false;
  }
}

/**
 * Sign in with Apple
 */
export async function signInWithApple(): Promise<AuthResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // Sign in to Supabase with Apple ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken!,
    });

    if (error) {
      console.error('Apple sign in error:', error);
      return { user: null, session: null, error };
    }

    console.log('User signed in with Apple successfully:', data.user?.email);
    return { user: data.user, session: data.session, error: null };
  } catch (error: any) {
    console.error('Unexpected Apple sign in error:', error);

    // User cancelled the sign-in
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return {
        user: null,
        session: null,
        error: { message: 'Sign in cancelled', name: 'AuthError', status: 400 } as AuthError,
      };
    }

    return {
      user: null,
      session: null,
      error: error as AuthError,
    };
  }
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('Sign up error:', error);
      return { user: null, session: null, error };
    }

    console.log('User signed up successfully:', data.user?.email);
    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    console.error('Unexpected sign up error:', error);
    return {
      user: null,
      session: null,
      error: error as AuthError,
    };
  }
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      return { user: null, session: null, error };
    }

    console.log('User signed in successfully:', data.user?.email);
    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    console.error('Unexpected sign in error:', error);
    return {
      user: null,
      session: null,
      error: error as AuthError,
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  try {
    // Clear user cache
    clearUserCache();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out error:', error);
      return { error };
    }

    console.log('User signed out successfully');
    return { error: null };
  } catch (error) {
    console.error('Unexpected sign out error:', error);
    return { error: error as AuthError };
  }
}

/**
 * Get the current user session
 */
export async function getSession(): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

// Cache to prevent concurrent getSession calls from causing deadlock
let cachedUser: User | null = null;
let cachedUserTimestamp: number = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

// Mutex to prevent concurrent getSession calls
let pendingUserFetch: Promise<User | null> | null = null;

/**
 * Get the current user
 * Uses in-memory cache and mutex to avoid concurrent Supabase calls that cause deadlock
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    // Return cached user if still valid
    const now = Date.now();
    if (cachedUser && (now - cachedUserTimestamp) < CACHE_DURATION) {
      console.log('[Auth] getCurrentUser: Returning cached user:', cachedUser.id);
      return cachedUser;
    }

    // If a fetch is already in progress, wait for it instead of starting a new one
    if (pendingUserFetch) {
      console.log('[Auth] getCurrentUser: Waiting for pending fetch...');
      return await pendingUserFetch;
    }

    // Start a new fetch and store the promise
    console.log('[Auth] getCurrentUser: Starting new fetch...');
    pendingUserFetch = (async () => {
      try {
        console.log('[Auth] getCurrentUser: Fetching session...');
        // First try to get from cached session (fast, no network call)
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('[Auth] getCurrentUser: Session fetched, has user?', !!sessionData.session?.user);

        if (sessionData.session?.user) {
          console.log('[Auth] getCurrentUser: Caching user:', sessionData.session.user.id);
          cachedUser = sessionData.session.user;
          cachedUserTimestamp = Date.now();
          return sessionData.session.user;
        }

        // Fallback to getUser if no session (makes network call)
        console.log('[Auth] No cached session, fetching user from server...');
        const { data } = await supabase.auth.getUser();
        console.log('[Auth] getCurrentUser: User fetched from server:', data.user?.id);

        if (data.user) {
          cachedUser = data.user;
          cachedUserTimestamp = Date.now();
        }

        return data.user;
      } finally {
        // Clear the pending fetch so new calls can proceed
        pendingUserFetch = null;
      }
    })();

    return await pendingUserFetch;
  } catch (error) {
    console.error('[Auth] Error getting current user:', error);
    pendingUserFetch = null; // Clear on error
    return null;
  }
}

/**
 * Clear the cached user (call on sign out)
 */
export function clearUserCache(): void {
  cachedUser = null;
  cachedUserTimestamp = 0;
}

/**
 * Get the current user's profile
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Unexpected error fetching profile:', error);
    return null;
  }
}

/**
 * Check if user's trial has expired
 */
export function isTrialExpired(profile: Profile): boolean {
  const now = new Date();
  const trialEnds = new Date(profile.trial_ends_at);
  return now > trialEnds;
}

/**
 * Check if user has active subscription (trial or paid)
 */
export function hasActiveSubscription(profile: Profile): boolean {
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
export function getTrialDaysRemaining(profile: Profile): number {
  const now = new Date();
  const trialEnds = new Date(profile.trial_ends_at);
  const diffTime = trialEnds.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<{ error: AuthError | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      console.error('Password reset error:', error);
      return { error };
    }

    console.log('Password reset email sent to:', email);
    return { error: null };
  } catch (error) {
    console.error('Unexpected password reset error:', error);
    return { error: error as AuthError };
  }
}
