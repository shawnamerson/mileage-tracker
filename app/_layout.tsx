import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { isOnboardingCompleted } from '@/services/onboardingService';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { shouldShowPaywall, initializeIAP, cleanupIAP } from '@/services/subscriptionService';
import { initializeSync } from '@/services/syncService';
import { isAutoTrackingEnabled, isAutoTrackingActive, startAutoTracking } from '@/services/autoTracking';
import { LoadingAnimation } from '@/components/LoadingAnimation';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const { user, loading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  // Initialize IAP connection on app start
  useEffect(() => {
    // Wrap in try-catch to prevent crashes
    const setupIAP = async () => {
      try {
        await initializeIAP();
        console.log('[App] IAP initialized successfully');
      } catch (error) {
        console.error('[App] Failed to initialize IAP:', error);
        // Continue without IAP - don't crash the app
      }
    };

    setupIAP();

    // Cleanup on unmount
    return () => {
      try {
        cleanupIAP();
      } catch (error) {
        console.error('[App] Error cleaning up IAP:', error);
      }
    };
  }, []);

  // Initialize sync (process offline queue) when user is authenticated
  useEffect(() => {
    if (user) {
      try {
        initializeSync();
        console.log('[App] Sync initialized - processing offline queue');
      } catch (error) {
        console.error('[App] Failed to initialize sync:', error);
      }
    }
  }, [user]);

  // Restart auto-tracking if it was previously enabled
  useEffect(() => {
    if (user) {
      const restartAutoTracking = async () => {
        try {
          const wasEnabled = await isAutoTrackingEnabled();
          const isCurrentlyActive = await isAutoTrackingActive();

          if (wasEnabled && !isCurrentlyActive) {
            console.log('[App] Auto-tracking was enabled but not running - restarting...');
            const started = await startAutoTracking();
            if (started) {
              console.log('[App] ✅ Auto-tracking restarted successfully');
            } else {
              console.log('[App] ⚠️ Failed to restart auto-tracking - check permissions');
            }
          } else if (wasEnabled && isCurrentlyActive) {
            console.log('[App] ✅ Auto-tracking already running');
          } else {
            console.log('[App] Auto-tracking not enabled');
          }
        } catch (error) {
          console.error('[App] Error restarting auto-tracking:', error);
        }
      };

      // Delay slightly to ensure permissions are ready
      setTimeout(restartAutoTracking, 1000);
    }
  }, [user]);

  useEffect(() => {
    async function handleNavigation() {
      console.log('[App] handleNavigation - loading:', loading, 'user:', !!user, 'segments:', segments);

      // Wait for auth to finish loading
      if (loading) {
        console.log('[App] Waiting for auth to finish loading...');
        return;
      }

      console.log('[App] Starting navigation logic...');

      try {
        const inAuthGroup = segments[0] === 'auth';
        const inOnboarding = segments[0] === 'onboarding';
        const inTabs = segments[0] === '(tabs)';
        const inSubscription = segments[0] === 'subscription';

        console.log('[App] Navigation context - inAuthGroup:', inAuthGroup, 'inOnboarding:', inOnboarding, 'inTabs:', inTabs, 'inSubscription:', inSubscription);

        // Not authenticated - redirect to sign-up for new users
        if (!user && !inAuthGroup) {
          router.replace('/auth/sign-up');
          return;
        }

        // Authenticated - check onboarding and subscription
        if (user) {
          console.log('[App] User authenticated, checking onboarding status...');

          // Add timeout protection for onboarding check (in case Supabase hangs)
          let completed = false;
          try {
            const onboardingPromise = isOnboardingCompleted();
            const timeoutPromise = new Promise<boolean>((resolve) =>
              setTimeout(() => {
                console.log('[App] Onboarding check timeout - assuming completed');
                resolve(true); // Assume completed to avoid blocking
              }, 5000)
            );
            completed = await Promise.race([onboardingPromise, timeoutPromise]);
            console.log('[App] Onboarding completed:', completed);
          } catch (error) {
            console.error('[App] Error checking onboarding:', error);
            completed = true; // Assume completed on error
          }

          if (!completed && !inOnboarding) {
            // Not completed onboarding - redirect to onboarding
            console.log('[App] Redirecting to onboarding...');
            router.replace('/onboarding');
          } else if (completed) {
            console.log('[App] Checking paywall status...');
            // Check if should show paywall (trial expired and no subscription)
            // Add timeout protection for Expo Go/slow connections
            let showPaywall = false;
            try {
              const paywallPromise = shouldShowPaywall();
              const timeoutPromise = new Promise<boolean>((resolve) =>
                setTimeout(() => {
                  console.log('[App] Paywall check timeout - assuming no paywall');
                  resolve(false);
                }, 5000)
              );
              showPaywall = await Promise.race([paywallPromise, timeoutPromise]);
              console.log('[App] Paywall check result:', showPaywall);
            } catch (error) {
              console.error('[App] Error checking paywall:', error);
              showPaywall = false; // Assume no paywall on error
            }

            if (showPaywall && !inSubscription) {
              // Trial expired, redirect to paywall
              console.log('[App] Redirecting to paywall...');
              router.replace('/subscription/paywall');
            } else if (!showPaywall && !inTabs && !inAuthGroup && !inSubscription) {
              // Has access, completed onboarding - redirect to tabs
              console.log('[App] Redirecting to tabs (completed onboarding, no paywall)...');
              router.replace('/(tabs)');
            } else if (inAuthGroup) {
              // Already authenticated but on auth screen - redirect to tabs
              console.log('[App] Redirecting to tabs (already authenticated)...');
              router.replace('/(tabs)');
            } else {
              console.log('[App] No navigation needed - already in correct location');
            }
          }
        }
      } catch (error) {
        console.error('[App] Error handling navigation:', error);
      } finally {
        console.log('[App] Setting isReady to true...');
        setIsReady(true);
      }
    }

    handleNavigation();
  }, [user, loading, segments]);

  if (!isReady || loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingAnimation text="Loading MileMate..." />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* Routes with their own _layout.tsx handle their own screens */}
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="subscription" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
