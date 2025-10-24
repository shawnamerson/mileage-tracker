import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { getActiveTrip, isTrackingActive } from '@/services/backgroundTracking';
import { getQueueStatus, processQueue } from '@/services/syncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function TripDiagnostic() {
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [queueStatus, setQueueStatus] = useState({ total: 0, pending: 0, failed: 0 });
  const [rawStorage, setRawStorage] = useState<any>({});

  const runDiagnostic = async () => {
    console.log('\n=== TRIP DIAGNOSTIC START ===\n');

    // Check active trip
    const trip = await getActiveTrip();
    setActiveTrip(trip);
    console.log('Active Trip:', trip ? {
      distance: trip.distance,
      start_time: new Date(trip.start_time).toLocaleString(),
      age_minutes: ((Date.now() - trip.start_time) / 60000).toFixed(1)
    } : 'None');

    // Check tracking status
    const tracking = await isTrackingActive();
    setIsTracking(tracking);
    console.log('Tracking Active:', tracking);

    // Check queue
    const queue = await getQueueStatus();
    setQueueStatus(queue);
    console.log('Queue Status:', queue);

    // Check raw AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    const relevantKeys = keys.filter(k =>
      k.includes('active_trip') ||
      k.includes('offline_queue') ||
      k.includes('tracking')
    );

    const storage: any = {};
    for (const key of relevantKeys) {
      const value = await AsyncStorage.getItem(key);
      storage[key] = value;
      console.log(`Storage [${key}]:`, value);
    }
    setRawStorage(storage);

    console.log('\n=== TRIP DIAGNOSTIC END ===\n');
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  const handleProcessQueue = async () => {
    console.log('Manually processing queue...');
    const result = await processQueue();
    console.log('Queue processed:', result);
    await runDiagnostic();
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔍 Trip Diagnostic</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Trip</Text>
        {activeTrip ? (
          <View>
            <Text>✅ Found in AsyncStorage</Text>
            <Text>Distance: {activeTrip.distance.toFixed(2)} miles</Text>
            <Text>Started: {new Date(activeTrip.start_time).toLocaleString()}</Text>
            <Text>Age: {((Date.now() - activeTrip.start_time) / 60000).toFixed(1)} minutes</Text>
            <Text>Purpose: {activeTrip.purpose}</Text>
          </View>
        ) : (
          <Text>❌ No active trip in AsyncStorage</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tracking Status</Text>
        <Text>{isTracking ? '✅ Tracking Active' : '❌ Not Tracking'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Offline Queue</Text>
        <Text>Total: {queueStatus.total}</Text>
        <Text>Pending: {queueStatus.pending}</Text>
        <Text>Failed: {queueStatus.failed}</Text>
        {queueStatus.pending > 0 && (
          <TouchableOpacity
            style={styles.button}
            onPress={handleProcessQueue}
          >
            <Text style={styles.buttonText}>Process Queue Now</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Raw Storage</Text>
        <Text style={styles.code}>
          {JSON.stringify(rawStorage, null, 2)}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={runDiagnostic}
      >
        <Text style={styles.buttonText}>Refresh Diagnostic</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: '#e0e0e0',
    padding: 8,
    borderRadius: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
});
