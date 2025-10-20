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
import { createTrip } from '@/services/tripService';
import {
  getCurrentLocation,
  reverseGeocode,
  calculateDistance,
  LocationCoords,
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
  const [mode, setMode] = useState<'manual' | 'live'>('live');
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);

  // Manual mode state
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [startCoords, setStartCoords] = useState<LocationCoords | null>(null);
  const [endCoords, setEndCoords] = useState<LocationCoords | null>(null);
  const [distance, setDistance] = useState('');

  // Shared state
  const [purpose, setPurpose] = useState<'business' | 'personal' | 'medical' | 'charity' | 'other'>(
    'business'
  );
  const [notes, setNotes] = useState('');

  const purposes = ['business', 'personal', 'medical', 'charity', 'other'] as const;

  // Check for active trip on mount and when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      checkActiveTrip();

      // Set up interval to update active trip data
      const interval = setInterval(() => {
        if (tracking) {
          checkActiveTrip();
        }
      }, 2000);

      return () => clearInterval(interval);
    }, [tracking])
  );

  const checkActiveTrip = async () => {
    const isActive = await isTrackingActive();
    const trip = await getActiveTrip();
    setTracking(isActive);
    setActiveTrip(trip);
    if (trip) {
      setPurpose(trip.purpose);
      setNotes(trip.notes || '');
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
            let endLat = completedTrip.lastLatitude;
            let endLon = completedTrip.lastLongitude;

            if (location) {
              endLocation = await reverseGeocode(location.latitude, location.longitude);
              endLat = location.latitude;
              endLon = location.longitude;
            }

            // Save trip to database
            const now = Date.now();
            await createTrip({
              startLocation: completedTrip.startLocation,
              endLocation,
              startLatitude: completedTrip.startLatitude,
              startLongitude: completedTrip.startLongitude,
              endLatitude: endLat,
              endLongitude: endLon,
              distance: completedTrip.distance,
              startTime: completedTrip.startTime,
              endTime: now,
              purpose: completedTrip.purpose,
              notes: completedTrip.notes,
            });

            // Only clear trip data AFTER successful save
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
          } catch (error) {
            console.error('Error stopping trip:', error);
            Alert.alert('Error', 'Failed to save trip. You can try again from the home screen.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleGetCurrentLocation = async (type: 'start' | 'end') => {
    setLoading(true);
    try {
      const location = await getCurrentLocation();
      if (location) {
        const address = await reverseGeocode(location.latitude, location.longitude);

        if (type === 'start') {
          setStartLocation(address);
          setStartCoords(location);
          if (endCoords) {
            const dist = calculateDistance(
              location.latitude,
              location.longitude,
              endCoords.latitude,
              endCoords.longitude
            );
            setDistance(dist.toString());
          }
        } else {
          setEndLocation(address);
          setEndCoords(location);
          if (startCoords) {
            const dist = calculateDistance(
              startCoords.latitude,
              startCoords.longitude,
              location.latitude,
              location.longitude
            );
            setDistance(dist.toString());
          }
        }
      } else {
        Alert.alert('Error', 'Failed to get location. Please check location permissions.');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get location');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualTrip = async () => {
    if (!startLocation || !endLocation || !distance) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    const distanceNum = parseFloat(distance);
    if (isNaN(distanceNum) || distanceNum <= 0) {
      Alert.alert('Invalid Distance', 'Please enter a valid distance');
      return;
    }

    setLoading(true);
    try {
      const now = Date.now();
      await createTrip({
        startLocation,
        endLocation,
        startLatitude: startCoords?.latitude,
        startLongitude: startCoords?.longitude,
        endLatitude: endCoords?.latitude,
        endLongitude: endCoords?.longitude,
        distance: distanceNum,
        startTime: now - 3600000, // 1 hour ago as default
        endTime: now,
        purpose,
        notes: notes || undefined,
      });

      Alert.alert('Success', 'Trip saved successfully', [
        {
          text: 'OK',
          onPress: () => {
            setStartLocation('');
            setEndLocation('');
            setStartCoords(null);
            setEndCoords(null);
            setDistance('');
            setPurpose('business');
            setNotes('');
            router.push('/(tabs)');
          },
        },
      ]);
    } catch (error) {
      console.error('Error saving trip:', error);
      Alert.alert('Error', 'Failed to save trip');
    } finally {
      setLoading(false);
    }
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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Track Trip</ThemedText>
      </ThemedView>

      {/* Mode Selector */}
      {!tracking && (
        <ThemedView style={styles.modeSelector}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              { borderColor: colors.primary },
              mode === 'live' && { backgroundColor: colors.primary }
            ]}
            onPress={() => setMode('live')}
          >
            <ThemedText style={[
              styles.modeText,
              { color: colors.primary },
              mode === 'live' && { color: colors.textInverse }
            ]}>
              Live Tracking
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              { borderColor: colors.primary },
              mode === 'manual' && { backgroundColor: colors.primary }
            ]}
            onPress={() => setMode('manual')}
          >
            <ThemedText style={[
              styles.modeText,
              { color: colors.primary },
              mode === 'manual' && { color: colors.textInverse }
            ]}>
              Manual Entry
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      )}

      {/* Live Tracking Mode */}
      {mode === 'live' && (
        <>
          {tracking && activeTrip ? (
            <ThemedView style={[styles.activeTrip, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
              <ThemedView style={[styles.tripStatusBadge, { backgroundColor: colors.success }]}>
                <ThemedText style={[styles.tripStatusText, { color: colors.textInverse }]}>TRIP IN PROGRESS</ThemedText>
              </ThemedView>

              <ThemedView style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Start Location:</ThemedText>
                <ThemedText style={styles.statValue}>{activeTrip.startLocation}</ThemedText>
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
                  {formatDuration(activeTrip.startTime)}
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
                  Live tracking will automatically record your distance as you drive. Keep the app running in the background.
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
        </>
      )}

      {/* Manual Entry Mode */}
      {mode === 'manual' && (
        <>
          <ThemedView style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Start Location
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]}
              value={startLocation}
              onChangeText={setStartLocation}
              placeholder="Enter start location"
              placeholderTextColor={colors.textTertiary}
            />
            <TouchableOpacity
              style={styles.button}
              onPress={() => handleGetCurrentLocation('start')}
              disabled={loading}
            >
              <ThemedText style={styles.buttonText}>Use Current Location</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              End Location
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]}
              value={endLocation}
              onChangeText={setEndLocation}
              placeholder="Enter end location"
              placeholderTextColor={colors.textTertiary}
            />
            <TouchableOpacity
              style={styles.button}
              onPress={() => handleGetCurrentLocation('end')}
              disabled={loading}
            >
              <ThemedText style={styles.buttonText}>Use Current Location</ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Distance (miles)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]}
              value={distance}
              onChangeText={setDistance}
              placeholder="Enter distance"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
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
              numberOfLines={4}
            />
          </ThemedView>

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.buttonDisabled]}
            onPress={handleSaveManualTrip}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.saveButtonText}>Save Trip</ThemedText>
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
  modeSelector: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
    ...Shadows.sm,
  },
  modeButtonActive: {
    backgroundColor: Colors.primary,
  },
  modeText: {
    color: Colors.primary,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  modeTextActive: {
    color: Colors.textInverse,
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
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  distanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
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
  button: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  buttonText: {
    color: Colors.textInverse,
    fontWeight: Typography.semibold,
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
  purposeButtonActive: {
    backgroundColor: '#007AFF',
  },
  purposeText: {
    color: '#007AFF',
    fontSize: 14,
  },
  purposeTextActive: {
    color: '#fff',
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
  saveButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
    padding: Spacing.lg,
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.md,
  },
  saveButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
});
