import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { isOnboardingCompleted } from '@/services/onboardingService';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { getCurrentUser } from '@/services/authService';
// TEMPORARILY DISABLED FOR DEBUGGING - ALL IAP IMPORTS
// import { shouldShowPaywall } from '@/services/subscriptionService';
// import { initializeIAP, cleanupIAP } from '@/services/subscriptionService';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootNavigator() {
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const { user, loading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  // Initialize IAP connection on app start
  // TEMPORARILY DISABLED FOR DEBUGGING
  /*
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
  */

  useEffect(() => {
    async function handleNavigation() {
      // Wait for auth to finish loading
      if (loading) {
        return;
      }

      try {
        const inAuthGroup = segments[0] === 'auth';
        const inOnboarding = segments[0] === 'onboarding';
        const inTabs = segments[0] === '(tabs)';
        const inSubscription = segments[0] === 'subscription';

        // Not authenticated - redirect to auth
        if (!user && !inAuthGroup) {
          router.replace('/auth/sign-in');
          return;
        }

        // Authenticated - check onboarding and subscription
        if (user) {
          const completed = await isOnboardingCompleted();

          if (!completed && !inOnboarding) {
            // Not completed onboarding - redirect to onboarding
            router.replace('/onboarding');
          } else if (completed) {
            // TEMPORARILY DISABLED: Check if should show paywall
            // For now, just let users access the app (they still have trial)
            const showPaywall = false;

            // TODO: Re-enable this once IAP is fixed
            // const showPaywall = await shouldShowPaywall();

            if (showPaywall && !inSubscription) {
              // Trial expired, redirect to paywall
              router.replace('/subscription/paywall');
            } else if (!showPaywall && !inTabs && !inAuthGroup && !inSubscription) {
              // Has access, completed onboarding - redirect to tabs
              router.replace('/(tabs)');
            } else if (inAuthGroup) {
              // Already authenticated but on auth screen - redirect to tabs
              router.replace('/(tabs)');
            }
          }
        }
      } catch (error) {
        console.error('Error handling navigation:', error);
      } finally {
        setIsReady(true);
      }
    }

    handleNavigation();
  }, [user, loading, segments]);

  if (!isReady || loading) {
    return null; // Or a loading screen
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="auth/sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="auth/sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        <Stack.Screen name="subscription/paywall" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
