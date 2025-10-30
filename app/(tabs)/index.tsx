import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import {
  getTripStatsForToday,
  getBusinessDeductibleValueForToday,
  getAllTrips,
  Trip,
} from '@/services/tripService';
import {
  getLocalTrips,
  getLocalTripStatsForToday,
  getLocalBusinessDeductibleForToday,
  LocalTrip,
} from '@/services/localDatabase';
import { getRateForYear } from '@/services/mileageRateService';
// Removed sync service - app is now 100% offline
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Colors, useColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/Design';


export default function DashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedWithTrips, setHasLoadedWithTrips] = useState(false);
  const [todayStats, setTodayStats] = useState({
    totalTrips: 0,
    totalDistance: 0,
    businessTrips: 0,
    personalTrips: 0,
    businessDistance: 0,
    personalDistance: 0,
  });
  const [todayDeductible, setTodayDeductible] = useState(0);
  const [recentTrips, setRecentTrips] = useState<LocalTrip[]>([]);

  const loadData = async () => {
    // Don't load if auth is still loading or user is not logged in
    if (authLoading || !user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      console.log('[Dashboard] Loading from local SQLite...');

      // Get current year's mileage rate
      const currentYear = new Date().getFullYear();
      const ratePerMile = await getRateForYear(currentYear);

      // Load from local database (fast, always available)
      const [todayStatsData, todayDeductibleData, allTrips] = await Promise.all([
        getLocalTripStatsForToday(user.id),
        getLocalBusinessDeductibleForToday(user.id, ratePerMile),
        getLocalTrips(user.id),
      ]);

      console.log('[Dashboard] ✅ Loaded from local SQLite:', {
        trips: allTrips.length,
        todayTrips: todayStatsData.totalTrips,
      });

      setTodayStats(todayStatsData);
      setTodayDeductible(todayDeductibleData);

      // Get the 5 most recent trips
      const recent = allTrips
        .sort((a, b) => b.start_time - a.start_time)
        .slice(0, 5);
      setRecentTrips(recent);

      // Track if we've successfully loaded trips at least once
      if (allTrips.length > 0) {
        setHasLoadedWithTrips(true);
      }
    } catch (error) {
      console.error('[Dashboard] Error loading data:', error);
      // Use default values on error
      setTodayStats({
        totalTrips: 0,
        totalDistance: 0,
        businessTrips: 0,
        personalTrips: 0,
        businessDistance: 0,
        personalDistance: 0,
      });
      setTodayDeductible(0);
      setRecentTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Remove redundant useEffect - useFocusEffect handles initial load and focus
  // Keep a simple useEffect just to handle the case when auth completes with no user
  useEffect(() => {
    if (!authLoading && !user) {
      // Auth completed but no user - set loading to false
      setLoading(false);
      setHasLoadedWithTrips(false); // Reset on sign out
    }
  }, [authLoading, user]);

  useFocusEffect(
    React.useCallback(() => {
      // Load data when screen comes into focus
      if (!authLoading && user) {
        loadData();
      }
    }, [authLoading, user])
  );

  // Removed sync tracking - app is now 100% offline

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getPurposeColor = (purpose: string) => {
    switch (purpose) {
      case 'business':
        return colors.primary;
      case 'personal':
        return colors.textSecondary;
      case 'medical':
        return colors.error;
      case 'charity':
        return colors.success;
      default:
        return colors.textTertiary;
    }
  };

  const getPurposeEmoji = (purpose: string) => {
    switch (purpose) {
      case 'business':
        return '💼';
      case 'personal':
        return '🏠';
      case 'medical':
        return '⚕️';
      case 'charity':
        return '❤️';
      default:
        return '📍';
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <LoadingAnimation text="Loading your trips..." />
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">Mileage Tracker</ThemedText>
      </ThemedView>

      {/* Today Card */}
      <ThemedView style={[styles.periodCard, { backgroundColor: colors.surface }]}>
        <ThemedText type="subtitle" style={styles.periodTitle}>Today</ThemedText>

        <ThemedView style={[styles.metricsRow, { backgroundColor: 'transparent' }]}>
          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.info }]}>
              {todayStats.totalTrips}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Trips</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.warning }]}>
              {todayStats.totalDistance.toFixed(1)}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Miles</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.personal }]}>
              {todayStats.businessTrips}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Business</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.accent }]}>
              ${todayDeductible.toFixed(2)}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Deductible</ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      {/* Recent Trips */}
      <ThemedView style={{ backgroundColor: 'transparent' }}>
        <ThemedView style={[styles.recentHeader, { backgroundColor: 'transparent' }]}>
          <ThemedText type="subtitle">Recent Trips</ThemedText>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <ThemedText style={[styles.viewAllText, { color: colors.primary }]}>View All</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {recentTrips.length === 0 ? (
          <ThemedView style={styles.emptyState}>
            {loading ? (
              <>
                <LoadingAnimation text="Loading your trips..." />
              </>
            ) : (
              <ThemedText style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                No trips yet. Start tracking your mileage!
              </ThemedText>
            )}
          </ThemedView>
        ) : (
          <ThemedView style={styles.tripsList}>
            {recentTrips.map((trip) => (
              <ThemedView
                key={trip.id}
                style={[styles.tripCard, { backgroundColor: 'transparent', borderColor: colors.border }]}
              >
                <ThemedView style={styles.tripHeader}>
                  <ThemedView style={styles.tripHeaderLeft}>
                    <ThemedText style={styles.tripEmoji}>{getPurposeEmoji(trip.purpose)}</ThemedText>
                    <ThemedView style={styles.tripHeaderText}>
                      <ThemedText style={styles.tripDate}>{formatDate(trip.start_time)}</ThemedText>
                      <ThemedText style={[styles.tripTime, { color: colors.textTertiary }]}>
                        {formatTime(trip.start_time)}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                  <ThemedView style={styles.tripHeaderRight}>
                    <ThemedText style={[styles.tripDistance, { color: colors.primary }]}>
                      {trip.distance.toFixed(1)} mi
                    </ThemedText>
                    <ThemedText
                      style={[styles.tripPurpose, { color: getPurposeColor(trip.purpose) }]}
                    >
                      {trip.purpose.charAt(0).toUpperCase() + trip.purpose.slice(1)}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.tripRoute}>
                  <ThemedText style={[styles.tripLocation, { color: colors.text }]} numberOfLines={1}>
                    {trip.start_location}
                  </ThemedText>
                  <ThemedText style={[styles.tripArrow, { color: colors.textTertiary }]}>→</ThemedText>
                  <ThemedText style={[styles.tripLocation, { color: colors.text }]} numberOfLines={1}>
                    {trip.end_location}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            ))}
          </ThemedView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  header: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  periodCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    ...Shadows.lg,
  },
  periodTitle: {
    marginBottom: Spacing.lg,
    color: Colors.text,
    textAlign: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: '47%',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  metricValue: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  metricLabel: {
    marginTop: Spacing.xs,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
    textAlign: 'center',
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  viewAllText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.primary,
  },
  emptyState: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  tripsList: {
    gap: Spacing.md,
  },
  tripCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tripHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tripEmoji: {
    fontSize: Typography.xl,
    marginRight: Spacing.sm,
  },
  tripHeaderText: {
    flex: 1,
  },
  tripDate: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.text,
  },
  tripTime: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  tripHeaderRight: {
    alignItems: 'flex-end',
  },
  tripDistance: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.primary,
  },
  tripPurpose: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    marginTop: 2,
  },
  tripRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  tripLocation: {
    fontSize: Typography.sm,
    color: Colors.text,
    flex: 1,
  },
  tripArrow: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
    marginHorizontal: Spacing.xs,
  },
});
