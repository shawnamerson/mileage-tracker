import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { isOnboardingCompleted } from '@/services/onboardingService';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { shouldShowPaywall, initializeIAP, cleanupIAP } from '@/services/subscriptionService';
import { isAutoTrackingEnabled, isAutoTrackingActive, startAutoTracking } from '@/services/autoTracking';
import { initLocalDatabase } from '@/services/localDatabase';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { withTimeoutFallback, TIMEOUTS } from '@/utils/timeout';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const { user, loading } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const appState = useRef(AppState.currentState);

  // Initialize local database and IAP on app start
  useEffect(() => {
    const setup = async () => {
      // Initialize local database first
      try {
        await initLocalDatabase();
        console.log('[App] Local database initialized successfully');
      } catch (error) {
        console.error('[App] Failed to initialize local database:', error);
      }

      // Initialize IAP
      try {
        await initializeIAP();
        console.log('[App] IAP initialized successfully');
      } catch (error) {
        console.error('[App] Failed to initialize IAP:', error);
        // Continue without IAP - don't crash the app
      }
    };

    setup();

    // Cleanup on unmount
    return () => {
      try {
        cleanupIAP();
      } catch (error) {
        console.error('[App] Error cleaning up IAP:', error);
      }
    };
  }, []);

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
          // Suppress location permission errors in Expo Go (expected)
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('NSLocation') || errorMessage.includes('Info.plist')) {
            console.log('[App] ℹ️ Auto-tracking unavailable in Expo Go (use development build)');
          } else {
            console.error('[App] Error restarting auto-tracking:', error);
          }
        }
      };

      // Delay slightly to ensure permissions are ready
      setTimeout(restartAutoTracking, 1000);
    }
  }, [user]);

  // Note: Removed periodic sync - app is now 100% offline-first
  // All data is stored locally in SQLite, no cloud sync needed

  useEffect(() => {
    async function handleNavigation() {
      console.log('[App] handleNavigation - loading:', loading, 'user:', !!user, 'segments:', segments);

      // Wait for user initialization to finish
      if (loading) {
        console.log('[App] Waiting for user initialization...');
        return;
      }

      // User should always exist (auto-created by AuthContext)
      if (!user) {
        console.error('[App] No user after initialization - this should not happen');
        return;
      }

      console.log('[App] User initialized - showing UI immediately');

      // Set ready immediately - don't block on slow checks
      setIsReady(true);

      try {
        const inOnboarding = segments[0] === 'onboarding';
        const inTabs = segments[0] === '(tabs)';
        const inSubscription = segments[0] === 'subscription';

        console.log('[App] Navigation context - inOnboarding:', inOnboarding, 'inTabs:', inTabs, 'inSubscription:', inSubscription);

        // Navigate to dashboard if not already on a main screen
        if (!inTabs && !inOnboarding && !inSubscription) {
          console.log('[App] Not on main screen - redirecting to dashboard');
          router.replace('/(tabs)');
        }

        // Check onboarding/paywall in BACKGROUND (non-blocking)
        console.log('[App] Running background checks for onboarding/paywall...');

        // Check onboarding with timeout protection
        const completed = await withTimeoutFallback(
          isOnboardingCompleted(),
          TIMEOUTS.QUICK,
          'Onboarding check',
          true, // Assume completed on timeout
          (error) => console.warn('[App] Onboarding check timed out, assuming completed')
        );
        console.log('[App] Onboarding completed:', completed);

        if (!completed && !inOnboarding) {
          // Not completed onboarding - redirect to onboarding
          console.log('[App] Onboarding required - redirecting...');
          router.replace('/onboarding');
          return;
        }

        // Check paywall only if onboarding is complete
        if (completed) {
          console.log('[App] Checking paywall status in background...');
          const showPaywall = await withTimeoutFallback(
            shouldShowPaywall(),
            TIMEOUTS.QUICK,
            'Paywall check',
            false, // Assume no paywall on timeout
            (error) => console.warn('[App] Paywall check timed out, assuming no paywall')
          );
          console.log('[App] Paywall check result:', showPaywall);

          if (showPaywall && !inSubscription) {
            // Trial expired - redirect to paywall
            console.log('[App] Paywall required - redirecting...');
            router.replace('/subscription/paywall');
          } else {
            console.log('[App] Background checks complete - user has full access');
          }
        }
      } catch (error) {
        console.error('[App] Error handling navigation:', error);
      }
    }

    handleNavigation();
  }, [user, loading]); // Run on user/loading state changes

  // Only show loading screen while auth is loading (fast)
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingAnimation text="Loading MileMate..." />
      </View>
    );
  }

  // Once auth is loaded, show UI immediately (even if onboarding/paywall checks are pending)
  if (!isReady) {
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
        {/* Removed auth screens - app is now auth-free with auto-generated users */}
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
    <ErrorBoundary>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}
