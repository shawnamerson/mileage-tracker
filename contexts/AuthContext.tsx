import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '@/services/supabase';
import { getUserProfile } from '@/services/authService';
import { initializeSync } from '@/services/syncService';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    try {
      const userProfile = await getUserProfile(userId);
      setProfile(userProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  // Refresh profile (useful after subscription changes)
  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      console.log('[Auth] Signing out...');

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign out timeout')), 5000)
      );

      const signOutPromise = supabase.auth.signOut();

      await Promise.race([signOutPromise, timeoutPromise]).catch(error => {
        console.log('[Auth] Supabase sign out failed (continuing anyway):', error.message);
      });

      // Clear state regardless of whether Supabase call succeeded
      setSession(null);
      setUser(null);
      setProfile(null);
      console.log('[Auth] ✅ Signed out successfully');
    } catch (error) {
      console.error('[Auth] Error signing out:', error);
      // Force clear state even on error
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  // Initialize auth state
  useEffect(() => {
    // Add timeout protection to prevent app from hanging
    const initTimeout = setTimeout(() => {
      console.warn('Auth initialization timeout - setting loading to false');
      setLoading(false);
    }, 10000); // 10 second timeout

    // Get initial session
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        clearTimeout(initTimeout);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
          // Sync will be initialized by onAuthStateChange listener
        }

        setLoading(false);
      })
      .catch((error) => {
        clearTimeout(initTimeout);
        console.error('Error getting initial session:', error);
        // Set loading to false even on error to prevent infinite loading
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed:', _event);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);

        // Initialize sync in background - don't block UI
        initializeSync().catch((error: Error) => {
          console.error('Error initializing sync:', error);
        });
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    profile,
    loading,
    signOut: handleSignOut,
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
