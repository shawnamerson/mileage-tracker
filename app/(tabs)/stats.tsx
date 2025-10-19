import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTripStats, getMonthlyStats, getAllTrips } from '@/services/tripService';
import { getActiveVehicle, type Vehicle } from '@/services/vehicleService';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { Colors, useColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/Design';

export default function StatsScreen() {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalDistance: 0,
    businessTrips: 0,
    personalTrips: 0,
    businessDistance: 0,
    personalDistance: 0,
  });
  const [currentMonthStats, setCurrentMonthStats] = useState({
    trips: 0,
    distance: 0,
    businessDistance: 0,
  });
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  const loadData = async () => {
    try {
      const tripStats = await getTripStats();
      const now = new Date();
      const monthStats = await getMonthlyStats(now.getFullYear(), now.getMonth() + 1);
      const activeVehicle = await getActiveVehicle();

      setStats(tripStats);
      setCurrentMonthStats(monthStats);
      setVehicle(activeVehicle);
    } catch (error) {
      console.error('Error loading stats:', error);
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
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const exportToCSV = async () => {
    try {
      const trips = await getAllTrips();

      if (trips.length === 0) {
        Alert.alert('No Data', 'No trips to export');
        return;
      }

      const csvHeader = 'Date,Start Location,End Location,Distance (mi),Purpose,Notes\n';
      const csvRows = trips
        .map(
          (trip) =>
            `"${new Date(trip.startTime).toLocaleDateString()}","${trip.startLocation}","${
              trip.endLocation
            }","${trip.distance}","${trip.purpose}","${trip.notes || ''}"`
        )
        .join('\n');

      const csv = csvHeader + csvRows;
      const fileName = `mileage_report_${new Date().toISOString().split('T')[0]}.csv`;
      const file = new File(Paths.document, fileName);

      await file.write(csv);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri);
      } else {
        Alert.alert('Success', `Report saved to ${file.uri}`);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export report');
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
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
                {vehicle.currentMileage.toLocaleString()} mi
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.vehicleStat}>
              <ThemedText style={[styles.vehicleStatLabel, { color: colors.textSecondary }]}>Tracked Since</ThemedText>
              <ThemedText style={[styles.vehicleStatValue, { color: colors.primary }]}>
                {vehicle.initialMileage.toLocaleString()} mi
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.vehicleStat}>
              <ThemedText style={[styles.vehicleStatLabel, { color: colors.textSecondary }]}>Miles Tracked</ThemedText>
              <ThemedText style={[styles.vehicleStatValue, { color: colors.primary }]}>
                {(vehicle.currentMileage - vehicle.initialMileage).toLocaleString()} mi
              </ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      )}

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Overall Statistics
        </ThemedText>

        <ThemedView style={styles.statGrid}>
          <ThemedView style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <ThemedText style={[styles.statNumber, { color: colors.primary }]}>{stats.totalTrips}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Total Trips</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <ThemedText style={[styles.statNumber, { color: colors.primary }]}>{stats.totalDistance.toFixed(1)}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Total Miles</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <ThemedText style={[styles.statNumber, { color: colors.primary }]}>{stats.businessTrips}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Business Trips</ThemedText>
          </ThemedView>

          <ThemedView style={[styles.statBox, { backgroundColor: colors.surface }]}>
            <ThemedText style={[styles.statNumber, { color: colors.primary }]}>{stats.personalTrips}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Personal Trips</ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          This Month
        </ThemedText>

        <ThemedView style={[styles.monthCard, { backgroundColor: colors.surface }]}>
          <ThemedView style={styles.monthStat}>
            <ThemedText style={[styles.monthNumber, { color: colors.success }]}>{currentMonthStats.trips}</ThemedText>
            <ThemedText style={[styles.monthLabel, { color: colors.textSecondary }]}>Trips</ThemedText>
          </ThemedView>

          <ThemedView style={styles.monthStat}>
            <ThemedText style={[styles.monthNumber, { color: colors.success }]}>
              {currentMonthStats.distance.toFixed(1)}
            </ThemedText>
            <ThemedText style={[styles.monthLabel, { color: colors.textSecondary }]}>Total Miles</ThemedText>
          </ThemedView>

          <ThemedView style={styles.monthStat}>
            <ThemedText style={[styles.monthNumber, { color: colors.success }]}>
              {currentMonthStats.businessDistance.toFixed(1)}
            </ThemedText>
            <ThemedText style={[styles.monthLabel, { color: colors.textSecondary }]}>Business Miles</ThemedText>
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
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  statNumber: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
    color: Colors.primary,
    textAlign: 'center',
    flexShrink: 1,
  },
  statLabel: {
    marginTop: Spacing.xs,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  monthCard: {
    flexDirection: 'row',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    justifyContent: 'space-around',
    ...Shadows.lg,
  },
  monthStat: {
    alignItems: 'center',
  },
  monthNumber: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
    color: Colors.success,
  },
  monthLabel: {
    marginTop: Spacing.xs,
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  breakdownCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    gap: Spacing.lg,
    ...Shadows.md,
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
    ...Shadows.md,
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
    ...Shadows.lg,
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
