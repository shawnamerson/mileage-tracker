import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore has a 2048 byte limit, but Supabase tokens can exceed this
// Use AsyncStorage as fallback for large values (tokens are already encrypted)
const SECURE_STORE_MAX_SIZE = 2000; // Leave some buffer

// Secure storage adapter for auth tokens with large value support
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      // Try SecureStore first
      const value = await SecureStore.getItemAsync(key);
      if (value) return value;

      // Fallback to AsyncStorage for large values
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('[SecureStore] Error getting item:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      // If value is too large, use AsyncStorage instead
      if (value.length > SECURE_STORE_MAX_SIZE) {
        console.log(`[SecureStore] Value too large (${value.length} bytes), using AsyncStorage`);
        await AsyncStorage.setItem(key, value);
        // Remove from SecureStore if it was previously stored there
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {
          // Ignore errors if key doesn't exist
        }
      } else {
        await SecureStore.setItemAsync(key, value);
        // Remove from AsyncStorage if it was previously stored there
        try {
          await AsyncStorage.removeItem(key);
        } catch {
          // Ignore errors if key doesn't exist
        }
      }
    } catch (error) {
      console.error('[SecureStore] Error setting item:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      // Remove from both stores to be safe
      await Promise.all([
        SecureStore.deleteItemAsync(key).catch(() => {}),
        AsyncStorage.removeItem(key).catch(() => {}),
      ]);
    } catch (error) {
      console.error('[SecureStore] Error removing item:', error);
    }
  },
};

// Custom fetch with timeout
const fetchWithTimeout = async (url: RequestInfo | URL, options: RequestInit = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for all requests

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out after 10 seconds');
    }
    throw error;
  }
};

// Create Supabase client with extended timeouts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-client-info': 'milemate-mobile',
    },
    fetch: fetchWithTimeout, // Use custom fetch with timeout
  },
  db: {
    schema: 'public',
  },
  realtime: {
    timeout: 30000, // 30 second timeout for realtime connections
  },
});

// Database types
export interface Profile {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  subscription_expires_at: string | null;
}

export interface CloudTrip {
  id: string;
  user_id: string;
  start_location: string;
  end_location: string;
  start_latitude: number;
  start_longitude: number;
  end_latitude: number;
  end_longitude: number;
  distance: number;
  start_time: number;
  end_time: number;
  purpose: 'business' | 'personal' | 'medical' | 'charity' | 'other';
  notes: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
}
