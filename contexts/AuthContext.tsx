import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  initializeUser,
  getUserProfile,
  resetAppData,
  LocalUser,
  LocalProfile,
  type Profile,
} from '@/services/authService';
import { clearLocalDatabase } from '@/services/localDatabase';

interface AuthContextType {
  user: LocalUser | null;
  profile: LocalProfile | null;
  loading: boolean;
  resetApp: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  resetApp: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    try {
      const userProfile = await getUserProfile(userId);
      setProfile(userProfile);
    } catch (error) {
      console.error('[AuthContext] Error fetching profile:', error);
      setProfile(null);
    }
  };

  // Refresh profile (useful after subscription changes)
  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  // Reset app (clear all data and start fresh)
  const handleResetApp = async () => {
    try {
      console.log('[AuthContext] Resetting app...');

      // Clear local SQLite database
      console.log('[AuthContext] Clearing local database...');
      await clearLocalDatabase().catch(error => {
        console.error('[AuthContext] Error clearing local database (continuing):', error);
      });

      // Reset auth data
      await resetAppData();

      // Re-initialize user
      const newUser = await initializeUser();
      setUser(newUser);

      const newProfile = await getUserProfile(newUser.id);
      setProfile(newProfile);

      console.log('[AuthContext] ✅ App reset successfully');
    } catch (error) {
      console.error('[AuthContext] Error resetting app:', error);
      throw error;
    }
  };

  // Initialize user on first app launch
  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('[AuthContext] Initializing user...');

        // Auto-create user if doesn't exist
        const initializedUser = await initializeUser();
        setUser(initializedUser);

        // Load profile
        const userProfile = await getUserProfile(initializedUser.id);
        setProfile(userProfile);

        console.log('[AuthContext] User initialized:', initializedUser.email);
      } catch (error) {
        console.error('[AuthContext] Error initializing user:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const value = {
    user,
    profile,
    loading,
    resetApp: handleResetApp,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Re-export Profile type for backward compatibility with components
export type { Profile };
