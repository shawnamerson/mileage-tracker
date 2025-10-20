import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { initDatabase } from '@/services/database';
import { getTripStatsForYear, getAllTrips, getBusinessDeductibleValueForYear } from '@/services/tripService';
import { Trip } from '@/services/database';
import { useFocusEffect } from '@react-navigation/native';
import { getActiveTrip, isTrackingActive, ActiveTrip } from '@/services/backgroundTracking';
import { isAutoTrackingActive } from '@/services/autoTracking';
import { performAutoBackup, isBackupRecommended } from '@/services/backupService';
import { useRouter } from 'expo-router';
import { Colors, useColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/Design';

// Helper function to get purpose icon
function getPurposeIcon(purpose: string): string {
  switch (purpose) {
    case 'business':
      return '💼';
    case 'personal':
      return '🏠';
    case 'medical':
      return '🏥';
    case 'charity':
      return '❤️';
    case 'other':
      return '📌';
    default:
      return '📍';
  }
}

// Helper function to get purpose color with opacity
function getPurposeColor(purpose: string, colors: any): string {
  switch (purpose) {
    case 'business':
      return colors.primary + '20'; // 20% opacity
    case 'personal':
      return '#A78BFA20';
    case 'medical':
      return '#F472B620';
    case 'charity':
      return '#FBBF2420';
    case 'other':
      return colors.textSecondary + '20';
    default:
      return colors.primary + '20';
  }
}

// Helper function to format relative dates
function formatRelativeDate(timestamp: number): string {
  const tripDate = new Date(timestamp);
  const today = new Date();

  // Reset time to midnight for accurate day comparison
  const tripDay = new Date(tripDate.getFullYear(), tripDate.getMonth(), tripDate.getDate());
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffMs = currentDay.getTime() - tripDay.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return tripDate.toLocaleDateString();
  }
}

export default function DashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [autoTracking, setAutoTracking] = useState(false);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalDistance: 0,
    businessTrips: 0,
    personalTrips: 0,
    businessDistance: 0,
    personalDistance: 0,
  });
  const [deductibleValue, setDeductibleValue] = useState(0);
  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [currentYear] = useState(new Date().getFullYear());

  const loadData = async () => {
    try {
      await initDatabase();
      const tripStats = await getTripStatsForYear(currentYear);
      const trips = await getAllTrips();
      const deductible = await getBusinessDeductibleValueForYear(currentYear);
      const backupRecommended = await isBackupRecommended();

      setStats(tripStats);
      setDeductibleValue(deductible);
      setRecentTrips(trips.slice(0, 3));
      setShowBackupReminder(backupRecommended);

      // Check for active trip and auto-tracking
      const isActive = await isTrackingActive();
      const trip = await getActiveTrip();
      const autoActive = await isAutoTrackingActive();
      setTracking(isActive);
      setActiveTrip(trip);
      setAutoTracking(autoActive);

      // Perform auto-backup if needed (runs in background, doesn't block UI)
      performAutoBackup().catch((error) => {
        console.error('Auto-backup failed:', error);
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadData();

      // Set up interval to update active trip
      const interval = setInterval(async () => {
        // Re-check tracking state in case trip ended
        const isActive = await isTrackingActive();
        const trip = await getActiveTrip();

        setTracking(isActive);
        setActiveTrip(trip);
      }, 2000);

      return () => clearInterval(interval);
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">Mileage Tracker</ThemedText>
        <ThemedText style={styles.subtitle}>{currentYear} Year-to-Date</ThemedText>
      </ThemedView>

      {/* Auto-Tracking Status Banner */}
      {autoTracking && !tracking && (
        <TouchableOpacity
          style={[styles.autoTrackingBanner, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          onPress={() => router.push('/(tabs)/settings')}
        >
          <ThemedText style={[styles.autoTrackingText, { color: colors.primary }]}>
            🤖 Auto-tracking enabled • Monitoring for drives
          </ThemedText>
          <ThemedText style={[styles.autoTrackingSubtext, { color: colors.textSecondary }]}>
            Tap to configure
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* Backup Reminder Banner */}
      {showBackupReminder && (
        <TouchableOpacity
          style={[styles.backupReminderBanner, { backgroundColor: colors.surface, borderColor: colors.warning }]}
          onPress={() => router.push('/(tabs)/settings')}
        >
          <ThemedText style={[styles.backupReminderTitle, { color: colors.warning }]}>
            💾 Backup Recommended
          </ThemedText>
          <ThemedText style={[styles.backupReminderText, { color: colors.text }]}>
            Protect your trip data by creating a backup
          </ThemedText>
          <ThemedText style={[styles.backupReminderSubtext, { color: colors.textSecondary }]}>
            Tap to back up now
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* Active Trip Banner */}
      {tracking && activeTrip && (
        <TouchableOpacity
          style={[styles.activeTripBanner, { backgroundColor: colors.surface, borderColor: colors.accent }]}
          onPress={() => router.push('/(tabs)/add')}
        >
          <ThemedView style={styles.activeTripHeader}>
            <ThemedText style={[styles.activeTripBadge, { color: colors.accent }]}>TRIP IN PROGRESS</ThemedText>
            <ThemedText style={[styles.activeTripArrow, { color: colors.accent }]}>→</ThemedText>
          </ThemedView>
          <ThemedText
            style={[styles.activeTripDistance, { color: colors.accent }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {activeTrip.distance.toFixed(2)} miles
          </ThemedText>
          <ThemedText style={[styles.activeTripLocation, { color: colors.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">
            From {activeTrip.startLocation}
          </ThemedText>
          <ThemedText style={[styles.activeTripTap, { color: colors.textTertiary }]}>Tap to view details</ThemedText>
        </TouchableOpacity>
      )}

      <ThemedView style={styles.statsContainer}>
        <ThemedView style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle" style={[styles.statValue, { color: colors.primary }]}>
            {stats.totalTrips}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Total Trips</ThemedText>
        </ThemedView>

        <ThemedView style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle" style={[styles.statValue, { color: colors.primary }]}>
            {stats.totalDistance.toFixed(1)}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Total Miles</ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.statsContainer}>
        <ThemedView style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle" style={[styles.statValue, { color: colors.primary }]}>
            {stats.businessTrips}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Business Trips</ThemedText>
        </ThemedView>

        <ThemedView style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle" style={[styles.statValue, { color: colors.primary }]}>
            {stats.businessDistance.toFixed(1)}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Business Miles</ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.statsContainer}>
        <ThemedView style={[styles.statCard, styles.valueCard, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle" style={[styles.statValue, styles.valueAmount, { color: colors.accent }]}>
            ${deductibleValue.toFixed(2)}
          </ThemedText>
          <ThemedText style={styles.statLabel}>Total Deductible Value</ThemedText>
          <ThemedText style={styles.rateLabel}>{currentYear} business trips</ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Recent Trips</ThemedText>
        {recentTrips.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>No trips yet</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Tap the Add Trip tab to log your first trip
            </ThemedText>
          </ThemedView>
        ) : (
          recentTrips.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={[styles.tripCardContainer]}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/history')}
            >
              <ThemedView style={[styles.tripCard, { backgroundColor: colors.surface }]}>
                {/* Trip Type Badge */}
                <ThemedView style={[
                  styles.tripBadge,
                  { backgroundColor: getPurposeColor(trip.purpose, colors) }
                ]}>
                  <ThemedText style={styles.tripBadgeText}>
                    {getPurposeIcon(trip.purpose)} {trip.purpose}
                  </ThemedText>
                </ThemedView>

                {/* Route Display */}
                <ThemedView style={styles.routeContainer}>
                  <ThemedView style={styles.locationRow}>
                    <ThemedText style={styles.locationDot}>●</ThemedText>
                    <ThemedText
                      type="defaultSemiBold"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[styles.locationText, { color: colors.text }]}
                    >
                      {trip.startLocation}
                    </ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.arrowContainer}>
                    <ThemedText style={[styles.routeArrow, { color: colors.textTertiary }]}>
                      ↓
                    </ThemedText>
                  </ThemedView>

                  <ThemedView style={styles.locationRow}>
                    <ThemedText style={[styles.locationDot, { color: colors.accent }]}>●</ThemedText>
                    <ThemedText
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[styles.locationText, { color: colors.textSecondary }]}
                    >
                      {trip.endLocation}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>

                {/* Distance and Date Footer */}
                <ThemedView style={styles.tripFooter}>
                  <ThemedView style={[styles.distanceChip, { backgroundColor: colors.surfaceLight }]}>
                    <ThemedText style={[styles.distanceChipText, { color: colors.primary }]}>
                      📍 {trip.distance.toFixed(1)} mi
                    </ThemedText>
                  </ThemedView>
                  <ThemedText style={[styles.tripDate, { color: colors.textTertiary }]}>
                    {formatRelativeDate(trip.startTime)}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            </TouchableOpacity>
          ))
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  subtitle: {
    marginTop: Spacing.sm,
    opacity: 0.7,
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  statValue: {
    fontSize: Typography['3xl'],
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  statLabel: {
    marginTop: Spacing.xs,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  valueCard: {
    flex: 1,
  },
  valueAmount: {
    fontSize: Typography['4xl'],
  },
  rateLabel: {
    marginTop: Spacing.xs,
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  section: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  emptyState: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    ...Shadows.md,
  },
  emptyText: {
    fontSize: Typography.lg,
    color: Colors.textSecondary,
    fontWeight: Typography.semibold,
  },
  emptySubtext: {
    marginTop: Spacing.sm,
    fontSize: Typography.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  tripCardContainer: {
    marginTop: Spacing.md,
  },
  tripCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    ...Shadows.lg,
    overflow: 'hidden',
  },
  tripBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  tripBadgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    textTransform: 'capitalize',
    color: Colors.text,
  },
  routeContainer: {
    marginVertical: Spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  locationDot: {
    fontSize: Typography.sm,
    marginRight: Spacing.sm,
    color: Colors.primary,
  },
  locationText: {
    flex: 1,
    fontSize: Typography.base,
  },
  arrowContainer: {
    paddingLeft: Spacing.xs,
    marginLeft: 2,
  },
  routeArrow: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  distanceChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  distanceChipText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  tripDate: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
  },
  activeTripBanner: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    borderWidth: 2,
    ...Shadows.xl,
  },
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  activeTripBadge: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    letterSpacing: 1.2,
  },
  activeTripArrow: {
    fontSize: Typography['2xl'],
  },
  activeTripDistance: {
    fontSize: Typography['4xl'],
    fontWeight: Typography.bold,
    marginBottom: Spacing.sm,
  },
  activeTripLocation: {
    fontSize: Typography.sm,
    marginBottom: Spacing.sm,
  },
  activeTripTap: {
    fontSize: Typography.xs,
    fontStyle: 'italic',
  },
  autoTrackingBanner: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    ...Shadows.md,
  },
  autoTrackingText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xs,
  },
  autoTrackingSubtext: {
    fontSize: Typography.xs,
  },
  backupReminderBanner: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1.5,
    ...Shadows.md,
  },
  backupReminderTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    marginBottom: Spacing.xs,
  },
  backupReminderText: {
    fontSize: Typography.sm,
    marginBottom: Spacing.xs,
  },
  backupReminderSubtext: {
    fontSize: Typography.xs,
    fontStyle: 'italic',
  },
});
