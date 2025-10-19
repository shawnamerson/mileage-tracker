import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Get environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Secure storage adapter for auth tokens
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
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
