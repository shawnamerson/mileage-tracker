import React, { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import {
  getTripStatsForToday,
  getBusinessDeductibleValueForToday,
  getTripsByDateRange,
  Trip,
} from '@/services/tripService';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, useColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/Design';


export default function DashboardScreen() {
  const colors = useColors();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayStats, setTodayStats] = useState({
    totalTrips: 0,
    totalDistance: 0,
    businessTrips: 0,
    personalTrips: 0,
    businessDistance: 0,
    personalDistance: 0,
  });
  const [todayDeductible, setTodayDeductible] = useState(0);

  const loadData = async () => {
    // Don't load if auth is still loading or user is not logged in
    if (authLoading || !user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [todayStatsData, todayDeductibleData] = await Promise.all([
        getTripStatsForToday(),
        getBusinessDeductibleValueForToday(),
      ]);

      setTodayStats(todayStatsData);
      setTodayDeductible(todayDeductibleData);
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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Only load data when auth is ready and user is logged in
  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    } else if (!authLoading && !user) {
      // Auth completed but no user - set loading to false
      setLoading(false);
    }
  }, [authLoading, user]);

  useFocusEffect(
    React.useCallback(() => {
      // Only load and set up auto-refresh if user is logged in
      if (!authLoading && user) {
        loadData();

        // Reduce auto-refresh frequency to every 30 seconds to avoid excessive queries
        const interval = setInterval(() => {
          loadData();
        }, 30000);

        return () => clearInterval(interval);
      }
    }, [authLoading, user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
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
            <ThemedText style={[styles.metricValue, { color: colors.success }]}>
              {todayStats.totalTrips}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Trips</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.success }]}>
              {todayStats.totalDistance.toFixed(1)}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Miles</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.success }]}>
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
});
