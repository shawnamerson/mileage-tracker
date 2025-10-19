import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColors, useShadows, Spacing, BorderRadius } from '@/constants/Design';
import { useAuth } from '@/contexts/AuthContext';
import { getTrialDaysRemaining } from '@/services/authService';

// TEMPORARY PAYWALL - IAP DISABLED FOR DEBUGGING
// Original paywall backed up to paywall-original-backup.tsx
// TODO: Restore original once IAP is fixed

export default function PaywallScreen() {
  const colors = useColors();
  const shadows = useShadows();
  const { profile } = useAuth();

  const trialDaysRemaining = profile ? getTrialDaysRemaining(profile) : 0;
  const isTrialExpired = trialDaysRemaining <= 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Subscription Temporarily Unavailable
        </ThemedText>
        {!isTrialExpired && (
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining in your free
            trial
          </ThemedText>
        )}
      </View>

      {/* Message */}
      <View style={[styles.messageContainer, { backgroundColor: colors.surface }, shadows.md]}>
        <ThemedText type="subtitle" style={styles.messageTitle}>
          Coming Soon
        </ThemedText>

        <ThemedText style={[styles.messageText, { color: colors.textSecondary }]}>
          Subscription purchases are currently being set up. You can continue to use all features
          during your trial period.
        </ThemedText>

        <ThemedText style={[styles.messageText, { color: colors.textSecondary, marginTop: Spacing.md }]}>
          If your trial has expired, please contact support for assistance.
        </ThemedText>
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, { backgroundColor: colors.primary }]}
        onPress={() => router.replace('/(tabs)')}
      >
        <ThemedText style={[styles.continueButtonText, { color: colors.textInverse }]}>
          Continue to App
        </ThemedText>
      </TouchableOpacity>

      {/* Fine Print */}
      <ThemedText style={[styles.finePrint, { color: colors.textTertiary }]}>
        All app features are available during your trial period. Subscription options will be
        available soon.
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
  },
  messageContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  messageTitle: {
    marginBottom: Spacing.md,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  continueButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  finePrint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.lg,
  },
});
