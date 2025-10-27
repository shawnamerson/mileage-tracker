import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import {
  getTripStats,
  getAllTrips,
  getTripStatsForToday,
  getTripStatsForCurrentMonth,
  getTripStatsForYear,
  getBusinessDeductibleValueForToday,
  getBusinessDeductibleValueForCurrentMonth,
  getBusinessDeductibleValueForYear
} from '@/services/tripService';
import {
  getLocalTripStats,
  getLocalTrips,
  getLocalTripStatsForToday,
  getLocalTripStatsForCurrentMonth,
  getLocalTripStatsForYear,
  getLocalBusinessDeductibleForToday,
  getLocalBusinessDeductibleForCurrentMonth,
  getLocalBusinessDeductibleForYear,
} from '@/services/localDatabase';
import { getRateForYear } from '@/services/mileageRateService';
import { getActiveVehicle, type Vehicle } from '@/services/vehicleService';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { Colors, useColors, Spacing, BorderRadius, Typography } from '@/constants/Design';

export default function StatsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalDistance: 0,
    businessTrips: 0,
    personalTrips: 0,
    businessDistance: 0,
    personalDistance: 0,
  });
  const [todayStats, setTodayStats] = useState({
    totalTrips: 0,
    totalDistance: 0,
    businessTrips: 0,
    personalTrips: 0,
    businessDistance: 0,
    personalDistance: 0,
  });
  const [monthStats, setMonthStats] = useState({
    totalTrips: 0,
    totalDistance: 0,
    businessTrips: 0,
    personalTrips: 0,
    businessDistance: 0,
    personalDistance: 0,
  });
  const [yearStats, setYearStats] = useState({
    totalTrips: 0,
    totalDistance: 0,
    businessTrips: 0,
    personalTrips: 0,
    businessDistance: 0,
    personalDistance: 0,
  });
  const [todayDeductible, setTodayDeductible] = useState(0);
  const [monthDeductible, setMonthDeductible] = useState(0);
  const [yearDeductible, setYearDeductible] = useState(0);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      console.log('[Stats] Loading from local SQLite...');

      const currentYear = new Date().getFullYear();
      const ratePerMile = await getRateForYear(currentYear);

      // Load from local database (fast, always available)
      const [
        tripStats,
        todayStatsData,
        monthStatsData,
        yearStatsData,
        todayDeductibleData,
        monthDeductibleData,
        yearDeductibleData
      ] = await Promise.all([
        getLocalTripStats(user.id),
        getLocalTripStatsForToday(user.id),
        getLocalTripStatsForCurrentMonth(user.id),
        getLocalTripStatsForYear(user.id, currentYear),
        getLocalBusinessDeductibleForToday(user.id, ratePerMile),
        getLocalBusinessDeductibleForCurrentMonth(user.id, ratePerMile),
        getLocalBusinessDeductibleForYear(user.id, currentYear, ratePerMile)
      ]);

      // Load vehicle in background (don't block stats)
      getActiveVehicle()
        .then(vehicle => setVehicle(vehicle))
        .catch(error => console.log('[Stats] Could not load vehicle:', error));

      console.log('[Stats] ✅ Loaded from local SQLite');

      setStats(tripStats);
      setTodayStats(todayStatsData);
      setMonthStats(monthStatsData);
      setYearStats(yearStatsData);
      setTodayDeductible(todayDeductibleData);
      setMonthDeductible(monthDeductibleData);
      setYearDeductible(yearDeductibleData);
      setError(null);
    } catch (error) {
      console.error('[Stats] Error loading stats:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      // Use default values on error
      const defaultStats = {
        totalTrips: 0,
        totalDistance: 0,
        businessTrips: 0,
        personalTrips: 0,
        businessDistance: 0,
        personalDistance: 0,
      };
      setStats(defaultStats);
      setTodayStats(defaultStats);
      setMonthStats(defaultStats);
      setYearStats(defaultStats);
      setTodayDeductible(0);
      setMonthDeductible(0);
      setYearDeductible(0);
      setVehicle(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const exportToCSV = async () => {
    if (!user) return;

    try {
      const trips = await getLocalTrips(user.id);

      if (trips.length === 0) {
        Alert.alert('No Data', 'No trips to export');
        return;
      }

      const csvHeader = 'Date,Start Location,End Location,Distance (mi),Purpose,Notes\n';
      const csvRows = trips
        .map(
          (trip) =>
            `"${new Date(trip.start_time).toLocaleDateString()}","${trip.start_location}","${
              trip.end_location
            }","${trip.distance}","${trip.purpose}","${trip.notes || ''}"`
        )
        .join('\n');

      const csv = csvHeader + csvRows;
      const fileName = `mileage_report_${new Date().toISOString().split('T')[0]}.csv`;
      const file = new File(Paths.document, fileName);

      await file.write(csv);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Mileage Report',
        });
        Alert.alert('Success', 'Report exported successfully');
      } else {
        Alert.alert('Success', `Report saved to ${file.uri}`);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export report');
    }
  };

  if (error) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText style={{ color: colors.error, marginBottom: 16 }}>Error Loading Stats</ThemedText>
        <ThemedText style={{ color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20 }}>{error}</ThemedText>
        <TouchableOpacity
          style={{ marginTop: 20, padding: 12, backgroundColor: colors.primary, borderRadius: 8 }}
          onPress={() => {
            setError(null);
            setLoading(true);
            loadData();
          }}
        >
          <ThemedText style={{ color: colors.textInverse }}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <LoadingAnimation text="Loading statistics..." />
      </ThemedView>
    );
  }

  const businessPercentage =
    stats.totalDistance > 0 ? (stats.businessDistance / stats.totalDistance) * 100 : 0;
  const personalPercentage =
    stats.totalDistance > 0 ? (stats.personalDistance / stats.totalDistance) * 100 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">Statistics</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>Your mileage insights</ThemedText>
      </ThemedView>

      {vehicle && (
        <ThemedView style={[styles.vehicleCard, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle" style={[styles.vehicleTitle, { color: colors.primary }]}>
            {vehicle.name}
          </ThemedText>
          <ThemedView style={styles.vehicleStats}>
            <ThemedView style={styles.vehicleStat}>
              <ThemedText style={[styles.vehicleStatLabel, { color: colors.textSecondary }]}>Current Odometer</ThemedText>
              <ThemedText style={[styles.vehicleStatValue, { color: colors.primary }]}>
                {vehicle.current_mileage.toLocaleString()} mi
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.vehicleStat}>
              <ThemedText style={[styles.vehicleStatLabel, { color: colors.textSecondary }]}>Tracked Since</ThemedText>
              <ThemedText style={[styles.vehicleStatValue, { color: colors.primary }]}>
                {vehicle.initial_mileage.toLocaleString()} mi
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.vehicleStat}>
              <ThemedText style={[styles.vehicleStatLabel, { color: colors.textSecondary }]}>Miles Tracked</ThemedText>
              <ThemedText style={[styles.vehicleStatValue, { color: colors.primary }]}>
                {(vehicle.current_mileage - vehicle.initial_mileage).toLocaleString()} mi
              </ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      )}

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

      {/* MTD Card */}
      <ThemedView style={[styles.periodCard, { backgroundColor: colors.surface }]}>
        <ThemedText type="subtitle" style={styles.periodTitle}>Month-to-Date</ThemedText>

        <ThemedView style={[styles.metricsRow, { backgroundColor: 'transparent' }]}>
          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.medical }]}>
              {monthStats.totalTrips}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Trips</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.primary }]}>
              {monthStats.totalDistance.toFixed(1)}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Miles</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.warning }]}>
              {monthStats.businessTrips}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Business</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.accent }]}>
              ${monthDeductible.toFixed(2)}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Deductible</ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      {/* YTD Card */}
      <ThemedView style={[styles.periodCard, { backgroundColor: colors.surface }]}>
        <ThemedText type="subtitle" style={styles.periodTitle}>Year-to-Date</ThemedText>

        <ThemedView style={[styles.metricsRow, { backgroundColor: 'transparent' }]}>
          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.personal }]}>
              {yearStats.totalTrips}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Trips</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.info }]}>
              {yearStats.totalDistance.toFixed(1)}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Miles</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.warning }]}>
              {yearStats.businessTrips}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Business</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.metricItem, { backgroundColor: 'transparent' }]}>
            <ThemedText style={[styles.metricValue, { color: colors.accent }]}>
              ${yearDeductible.toFixed(2)}
            </ThemedText>
            <ThemedText style={styles.metricLabel}>Deductible</ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Distance Breakdown
        </ThemedText>

        <ThemedView style={[styles.breakdownCard, { backgroundColor: colors.surface }]}>
          <ThemedView style={styles.breakdownRow}>
            <ThemedText style={[styles.breakdownLabel, { color: colors.text }]}>Business</ThemedText>
            <ThemedView style={[styles.breakdownBarContainer, { backgroundColor: colors.borderLight }]}>
              <ThemedView
                style={[styles.breakdownBar, { width: `${businessPercentage}%`, backgroundColor: colors.primary }]}
              />
            </ThemedView>
            <ThemedText style={[styles.breakdownValue, { color: colors.textSecondary }]}>
              {stats.businessDistance.toFixed(1)} mi ({businessPercentage.toFixed(0)}%)
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.breakdownRow}>
            <ThemedText style={[styles.breakdownLabel, { color: colors.text }]}>Personal</ThemedText>
            <ThemedView style={[styles.breakdownBarContainer, { backgroundColor: colors.borderLight }]}>
              <ThemedView
                style={[
                  styles.breakdownBar,
                  { width: `${personalPercentage}%`, backgroundColor: colors.success },
                ]}
              />
            </ThemedView>
            <ThemedText style={[styles.breakdownValue, { color: colors.textSecondary }]}>
              {stats.personalDistance.toFixed(1)} mi ({personalPercentage.toFixed(0)}%)
            </ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Export Data
        </ThemedText>
        <TouchableOpacity style={[styles.exportButton, { backgroundColor: colors.primary }]} onPress={exportToCSV}>
          <ThemedText style={[styles.exportButtonText, { color: colors.textInverse }]}>Export to CSV</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.background,
  },
  header: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.xxl,
  },
  subtitle: {
    marginTop: Spacing.sm,
    opacity: 0.7,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  periodCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
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
  breakdownCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    gap: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  breakdownRow: {
    gap: Spacing.sm,
  },
  breakdownLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.text,
  },
  breakdownBarContainer: {
    height: 28,
    backgroundColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  breakdownBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  breakdownBarPersonal: {
    backgroundColor: Colors.success,
  },
  breakdownValue: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  exportButton: {
    padding: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  exportButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.base,
    fontWeight: Typography.bold,
  },
  vehicleCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  vehicleTitle: {
    marginBottom: Spacing.md,
    textAlign: 'center',
    color: Colors.primary,
  },
  vehicleStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  vehicleStat: {
    alignItems: 'center',
  },
  vehicleStatLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: Typography.medium,
  },
  vehicleStatValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.primary,
  },
});
