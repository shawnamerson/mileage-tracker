import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { createTrip, getTripsByDateRange } from '@/services/tripService';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCurrentLocation,
  reverseGeocode,
} from '@/services/locationService';
import {
  startBackgroundTracking,
  stopBackgroundTracking,
  clearActiveTrip,
  getActiveTrip,
  isTrackingActive,
  ActiveTrip,
} from '@/services/backgroundTracking';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, useColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/Design';

export default function AddTripScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [purpose, setPurpose] = useState<'business' | 'personal' | 'medical' | 'charity' | 'other'>(
    'business'
  );
  const [notes, setNotes] = useState('');
  const [recoveryAlertShown, setRecoveryAlertShown] = useState(false);

  // Prevent race conditions in trip recovery
  const isProcessingRecovery = React.useRef(false);

  const purposes = ['business', 'personal', 'medical', 'charity', 'other'] as const;

  // Check for active trip on mount and when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      checkActiveTrip();

      // Set up interval to update active trip data
      // Always check - the function is fast when there's no active trip
      const interval = setInterval(() => {
        checkActiveTrip();
      }, 2000);

      return () => clearInterval(interval);
    }, [])
  );

  const checkActiveTrip = async () => {
    // Prevent overlapping recovery checks (race condition fix)
    if (isProcessingRecovery.current) {
      console.log('[Add] Skipping checkActiveTrip - recovery already in progress');
      return;
    }

    const isActive = await isTrackingActive();
    const trip = await getActiveTrip();
    setTracking(isActive);
    setActiveTrip(trip);
    if (trip) {
      setPurpose(trip.purpose);
      setNotes(trip.notes || '');

      // Check for orphaned trip (trip exists but tracking not active)
      // This can happen if app crashed or auto-tracking failed
      const tripAge = Date.now() - trip.start_time;
      const fiveMinutes = 5 * 60 * 1000;

      if (!isActive && tripAge > fiveMinutes && !recoveryAlertShown) {
        // Lock to prevent concurrent recovery attempts
        isProcessingRecovery.current = true;

        try {
          // Before showing recovery alert, check if this trip was already saved by auto-tracking
          // This prevents duplicate saves when auto-tracking saves and user manually saves
          const startDate = new Date(trip.start_time);
          startDate.setHours(0, 0, 0, 0); // Start of day
          const endDate = new Date(trip.start_time);
          endDate.setHours(23, 59, 59, 999); // End of day

          const existingTrips = await getTripsByDateRange(startDate.getTime(), endDate.getTime());

          // Check if a trip with matching start_time and similar distance already exists
          const alreadySaved = existingTrips.some(existingTrip => {
            const timeDiff = Math.abs(existingTrip.start_time - trip.start_time);
            const distanceDiff = Math.abs(existingTrip.distance - trip.distance);
            // Consider it the same trip if start time is within 10 seconds and distance within 0.1 miles
            return timeDiff < 10000 && distanceDiff < 0.1;
          });

          if (alreadySaved) {
            console.log('[Add] Trip already saved by auto-tracking - clearing active trip without prompting');
            await clearActiveTrip();
            setActiveTrip(null);
            isProcessingRecovery.current = false;
            return;
          }

          // Show recovery alert only once
          setRecoveryAlertShown(true);

          // Offer to recover the trip
          Alert.alert(
            'Unsaved Trip Found',
            `Found a trip from ${new Date(trip.start_time).toLocaleString()} with ${trip.distance.toFixed(2)} miles. Do you want to save it?`,
            [
              {
                text: 'Discard',
                style: 'destructive',
                onPress: async () => {
                  await clearActiveTrip();
                  setActiveTrip(null);
                  setRecoveryAlertShown(false);
                  isProcessingRecovery.current = false;
                },
              },
              {
                text: 'Save Trip',
                onPress: async () => {
                  await handleRecoverTrip(trip);
                  setRecoveryAlertShown(false);
                  isProcessingRecovery.current = false;
                },
              },
            ],
            {
              onDismiss: () => {
                // Reset lock if user dismisses alert without choosing
                isProcessingRecovery.current = false;
              }
            }
          );
        } catch (error) {
          console.error('[Add] Error checking for existing trip:', error);
          isProcessingRecovery.current = false;
          // Continue to show recovery alert if check fails
        }
      }
    } else {
      // Reset recovery alert flag when no trip exists
      setRecoveryAlertShown(false);
      isProcessingRecovery.current = false;
    }
  };

  const handleRecoverTrip = async (trip: ActiveTrip) => {
    setLoading(true);
    try {
      // Get end location
      const location = await getCurrentLocation();
      let endLocation = 'Unknown';
      let endLat = trip.last_latitude;
      let endLon = trip.last_longitude;

      if (location) {
        endLocation = await reverseGeocode(location.latitude, location.longitude);
        endLat = location.latitude;
        endLon = location.longitude;
      }

      // Save trip to database
      const now = Date.now();
      if (!user) {
        throw new Error('User not logged in');
      }

      try {
        const tripData = {
          id: trip.id, // Use existing trip ID to prevent duplicates
          user_id: user.id,
          start_location: trip.start_location,
          end_location: endLocation,
          start_latitude: trip.start_latitude,
          start_longitude: trip.start_longitude,
          end_latitude: endLat,
          end_longitude: endLon,
          distance: trip.distance,
          start_time: trip.start_time,
          end_time: now,
          purpose: trip.purpose,
          notes: trip.notes || '',
        };

        // Save directly to local database with existing ID (prevents duplicates)
        const { saveLocalTrip } = await import('@/services/localDatabase');
        await saveLocalTrip(tripData);

        // Clear trip data after successful save
        await clearActiveTrip();
        setActiveTrip(null);
        setPurpose('business');
        setNotes('');

        Alert.alert('Success', `Trip recovered and saved! Distance: ${trip.distance.toFixed(2)} miles`, [
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)'),
          },
        ]);
      } catch (error: any) {
        console.error('Error recovering trip:', error);

        // Check if trip was queued for offline upload
        if (error.queued) {
          // Trip queued successfully - clear active trip
          await clearActiveTrip();
          setActiveTrip(null);
          setPurpose('business');
          setNotes('');

          Alert.alert(
            'Trip Saved Offline',
            `Your trip (${trip.distance.toFixed(2)} miles) has been saved and will sync when you're back online.`,
            [
              {
                text: 'OK',
                onPress: () => router.push('/(tabs)'),
              },
            ]
          );
        } else {
          // Real error - keep trip for recovery
          Alert.alert('Error', 'Failed to save trip. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error in recover trip handler:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartLiveTrip = async () => {
    setLoading(true);
    try {
      const location = await getCurrentLocation();
      if (!location) {
        Alert.alert('Error', 'Failed to get your current location. Please check location permissions.');
        setLoading(false);
        return;
      }

      const address = await reverseGeocode(location.latitude, location.longitude);

      const started = await startBackgroundTracking(
        address,
        location.latitude,
        location.longitude,
        purpose,
        notes || undefined
      );

      if (started) {
        setTracking(true);
        await checkActiveTrip();
        Alert.alert('Trip Started', 'Your trip is now being tracked in the background');
      } else {
        Alert.alert('Error', 'Failed to start tracking. Please ensure location permissions are granted.');
      }
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Failed to start trip tracking');
    } finally {
      setLoading(false);
    }
  };

  const handleStopLiveTrip = async () => {
    Alert.alert('Stop Trip', 'Do you want to stop and save this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop & Save',
        onPress: async () => {
          setLoading(true);
          try {
            const completedTrip = await stopBackgroundTracking();

            if (!completedTrip) {
              Alert.alert('Error', 'No active trip found');
              setLoading(false);
              return;
            }

            // Get end location
            const location = await getCurrentLocation();
            let endLocation = 'Unknown';
            let endLat = completedTrip.last_latitude;
            let endLon = completedTrip.last_longitude;

            if (location) {
              endLocation = await reverseGeocode(location.latitude, location.longitude);
              endLat = location.latitude;
              endLon = location.longitude;
            }

            // Save trip to database
            const now = Date.now();
            if (!user) {
              throw new Error('User not logged in');
            }

            try {
              const tripData = {
                id: completedTrip.id, // Use existing trip ID to prevent duplicates
                user_id: user.id,
                start_location: completedTrip.start_location,
                end_location: endLocation,
                start_latitude: completedTrip.start_latitude,
                start_longitude: completedTrip.start_longitude,
                end_latitude: endLat,
                end_longitude: endLon,
                distance: completedTrip.distance,
                start_time: completedTrip.start_time,
                end_time: now,
                purpose: completedTrip.purpose,
                notes: completedTrip.notes || '',
              };

              // Save directly to local database with existing ID (prevents duplicates)
              const { saveLocalTrip } = await import('@/services/localDatabase');
              await saveLocalTrip(tripData);

              // Clear trip data after successful save
              await clearActiveTrip();

              setTracking(false);
              setActiveTrip(null);
              setPurpose('business');
              setNotes('');

              Alert.alert('Success', `Trip saved! Distance: ${completedTrip.distance.toFixed(2)} miles`, [
                {
                  text: 'OK',
                  onPress: () => router.push('/(tabs)'),
                },
              ]);
            } catch (error: any) {
              console.error('Error stopping trip:', error);

              // Check if trip was queued for offline upload
              if (error.queued) {
                // Trip queued successfully - clear active trip
                await clearActiveTrip();
                setTracking(false);
                setActiveTrip(null);
                setPurpose('business');
                setNotes('');

                Alert.alert(
                  'Trip Saved Offline',
                  `Your trip (${completedTrip.distance.toFixed(2)} miles) has been saved and will sync when you're back online.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => router.push('/(tabs)'),
                    },
                  ]
                );
              } else {
                // Real error - keep trip for recovery
                Alert.alert('Error', 'Failed to save trip. You can try again from the home screen.');
              }
            }
          } catch (error) {
            console.error('Error in stop trip handler:', error);
            Alert.alert('Error', 'An unexpected error occurred.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const formatDuration = (startTime: number) => {
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <ThemedView style={styles.header}>
        <ThemedText type="title">Track Trip</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          {tracking ? 'Trip in progress' : 'Start tracking your trip'}
        </ThemedText>
      </ThemedView>

      {tracking && activeTrip ? (
        <ThemedView style={[styles.activeTrip, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
          <ThemedView style={[styles.tripStatusBadge, { backgroundColor: colors.success }]}>
            <ThemedText style={[styles.tripStatusText, { color: colors.textInverse }]}>TRIP IN PROGRESS</ThemedText>
          </ThemedView>

          <ThemedView style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Start Location:</ThemedText>
            <ThemedText style={styles.statValue}>{activeTrip.start_location}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Distance:</ThemedText>
            <ThemedText style={[styles.statValue, styles.distanceValue]}>
              {activeTrip.distance.toFixed(2)} miles
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Duration:</ThemedText>
            <ThemedText style={styles.statValue}>
              {formatDuration(activeTrip.start_time)}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.statRow}>
            <ThemedText style={styles.statLabel}>Purpose:</ThemedText>
            <ThemedText style={styles.statValue}>
              {activeTrip.purpose.charAt(0).toUpperCase() + activeTrip.purpose.slice(1)}
            </ThemedText>
          </ThemedView>

          <TouchableOpacity
            style={[styles.stopButton, loading && styles.buttonDisabled]}
            onPress={handleStopLiveTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.stopButtonText}>Stop & Save Trip</ThemedText>
            )}
          </TouchableOpacity>
        </ThemedView>
      ) : (
        <>
          <ThemedView style={[styles.infoBox, { backgroundColor: `${colors.accent}15` }]}>
            <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
              💡 Live tracking will automatically record your distance as you drive.
              Keep the app running in the background for accurate tracking.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Purpose
            </ThemedText>
            <ThemedView style={styles.purposeContainer}>
              {purposes.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.purposeButton,
                    { borderColor: colors.primary },
                    purpose === p && { backgroundColor: colors.primary }
                  ]}
                  onPress={() => setPurpose(p)}
                >
                  <ThemedText
                    style={[
                      styles.purposeText,
                      { color: colors.primary },
                      purpose === p && { color: colors.textInverse }
                    ]}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Notes (optional)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.notesInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes about this trip"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </ThemedView>

          <TouchableOpacity
            style={[styles.startButton, loading && styles.buttonDisabled]}
            onPress={handleStartLiveTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.startButtonText}>Start Trip</ThemedText>
            )}
          </TouchableOpacity>
        </>
      )}
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
    marginTop: Spacing.xs,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  infoBox: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  infoText: {
    fontSize: Typography.sm,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  activeTrip: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.lg,
    ...Shadows.lg,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  tripStatusBadge: {
    backgroundColor: '#34C759',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  tripStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statRow: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: 'transparent',
  },
  distanceValue: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 'bold',
    color: '#007AFF',
    backgroundColor: 'transparent',
    flexWrap: 'wrap',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.base,
    backgroundColor: Colors.surface,
    color: Colors.text,
    ...Shadows.sm,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  purposeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  purposeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
  },
  purposeText: {
    color: '#007AFF',
    fontSize: 14,
  },
  startButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
    padding: Spacing.lg,
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.md,
  },
  startButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  stopButton: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.md,
  },
  stopButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
});
