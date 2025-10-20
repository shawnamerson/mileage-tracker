import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { createVehicle } from '@/services/vehicleService';
import { completeOnboarding } from '@/services/onboardingService';
import {
  startAutoTracking,
  setDefaultPurpose,
} from '@/services/autoTracking';

type OnboardingStep = 'welcome' | 'vehicle' | 'mileage' | 'complete';

export default function OnboardingScreen() {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [loading, setLoading] = useState(false);

  // Vehicle details
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');

  // Mileage
  const [initialMileage, setInitialMileage] = useState('');

  const handleNext = async () => {
    if (step === 'welcome') {
      setStep('vehicle');
    } else if (step === 'vehicle') {
      if (!vehicleName.trim()) {
        Alert.alert('Required', 'Please enter a name for your vehicle');
        return;
      }
      setStep('mileage');
    } else if (step === 'mileage') {
      const mileage = parseFloat(initialMileage);
      if (isNaN(mileage) || mileage < 0) {
        Alert.alert('Invalid Mileage', 'Please enter a valid mileage number');
        return;
      }
      await handleComplete();
    }
  };

  const handleBack = () => {
    if (step === 'vehicle') {
      setStep('welcome');
    } else if (step === 'mileage') {
      setStep('vehicle');
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const mileage = parseFloat(initialMileage);

      // Create the vehicle
      await createVehicle({
        name: vehicleName.trim(),
        make: vehicleMake.trim() || undefined,
        model: vehicleModel.trim() || undefined,
        year: vehicleYear.trim() || undefined,
        initialMileage: mileage,
      });

      // Set default trip purpose to business
      await setDefaultPurpose('business');

      // Enable auto-tracking by default
      console.log('[Onboarding] Starting auto-tracking...');
      const autoTrackingStarted = await startAutoTracking();

      if (autoTrackingStarted) {
        console.log('[Onboarding] ✅ Auto-tracking enabled successfully');
      } else {
        console.log('[Onboarding] ⚠️ Auto-tracking failed to start - may need to grant permissions manually');
        Alert.alert(
          'Permissions Needed',
          'Please grant location permissions in the next screen to enable automatic trip tracking.',
          [{ text: 'OK' }]
        );
      }

      // Mark onboarding as complete
      await completeOnboarding();

      // Show completion step briefly
      setStep('complete');

      // Navigate to main app after a short delay
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 2000);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('Error', 'Failed to save vehicle information');
      setLoading(false);
    }
  };

  if (step === 'welcome') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Image
              source={require('@/assets/Wordmark.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <ThemedText type="title" style={styles.title}>
              Welcome to MileMate
            </ThemedText>

            <View style={styles.featureList}>
              <View style={styles.feature}>
                <ThemedText style={styles.featureIcon}>🚗</ThemedText>
                <ThemedText style={styles.featureText}>
                  Track your trips automatically
                </ThemedText>
              </View>

              <View style={styles.feature}>
                <ThemedText style={styles.featureIcon}>📍</ThemedText>
                <ThemedText style={styles.featureText}>
                  GPS-based distance calculation
                </ThemedText>
              </View>

              <View style={styles.feature}>
                <ThemedText style={styles.featureIcon}>📊</ThemedText>
                <ThemedText style={styles.featureText}>
                  Export for tax deductions
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.subtitle}>
              Let's set up your first vehicle
            </ThemedText>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <ThemedText style={styles.primaryButtonText}>Get Started</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (step === 'vehicle') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              Your Vehicle
            </ThemedText>

            <ThemedText style={styles.description}>
              Give your vehicle a name so you can identify it easily
            </ThemedText>

            <View style={styles.form}>
              <ThemedText style={styles.label}>Vehicle Name *</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g., My Honda, Work Truck"
                value={vehicleName}
                onChangeText={setVehicleName}
                autoFocus
              />

              <ThemedText style={styles.label}>Make (Optional)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g., Honda, Toyota"
                value={vehicleMake}
                onChangeText={setVehicleMake}
              />

              <ThemedText style={styles.label}>Model (Optional)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g., Accord, Camry"
                value={vehicleModel}
                onChangeText={setVehicleModel}
              />

              <ThemedText style={styles.label}>Year (Optional)</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2020"
                value={vehicleYear}
                onChangeText={setVehicleYear}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
            <ThemedText style={styles.secondaryButtonText}>Back</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <ThemedText style={styles.primaryButtonText}>Next</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (step === 'mileage') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              Current Mileage
            </ThemedText>

            <ThemedText style={styles.description}>
              Enter your car's current odometer reading. This helps track total miles driven.
            </ThemedText>

            <View style={styles.mileageInputContainer}>
              <ThemedText style={styles.mileageLabel}>Odometer Reading</ThemedText>
              <View style={styles.mileageInputWrapper}>
                <TextInput
                  style={styles.mileageInput}
                  placeholder="0"
                  value={initialMileage}
                  onChangeText={setInitialMileage}
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <ThemedText style={styles.mileageUnit}>miles</ThemedText>
              </View>
            </View>

            <View style={styles.tipBox}>
              <ThemedText style={styles.tipTitle}>💡 Tip</ThemedText>
              <ThemedText style={styles.tipText}>
                Check your car's dashboard for the odometer reading. It shows the total miles your vehicle has traveled.
              </ThemedText>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
            <ThemedText style={styles.secondaryButtonText}>Back</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleNext}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Complete Setup</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  if (step === 'complete') {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.completeContent}>
          <ThemedText style={styles.completeIcon}>✅</ThemedText>
          <ThemedText type="title" style={styles.completeTitle}>
            All Set!
          </ThemedText>
          <ThemedText style={styles.completeText}>
            Your vehicle has been configured successfully
          </ThemedText>
          <View style={styles.completeFeatures}>
            <ThemedText style={styles.completeFeature}>
              🚗 Auto-tracking enabled
            </ThemedText>
            <ThemedText style={styles.completeFeature}>
              📍 Speed-based tracking active
            </ThemedText>
            <ThemedText style={styles.completeFeature}>
              📊 Ready to track trips
            </ThemedText>
          </View>
          <ActivityIndicator size="large" style={styles.completeSpinner} />
        </View>
      </ThemedView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  logo: {
    width: 280,
    height: 100,
    marginBottom: 24,
    alignSelf: 'center',
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 32,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 32,
    lineHeight: 24,
  },
  featureList: {
    marginTop: 48,
    gap: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIcon: {
    fontSize: 32,
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  mileageInputContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  mileageLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  mileageInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mileageInput: {
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 32,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 150,
    backgroundColor: '#fff',
  },
  mileageUnit: {
    fontSize: 20,
    opacity: 0.6,
  },
  tipBox: {
    backgroundColor: 'rgba(255, 204, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  completeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completeIcon: {
    fontSize: 80,
    marginBottom: 24,
  },
  completeTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  completeText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 24,
  },
  completeFeatures: {
    gap: 12,
    alignItems: 'center',
  },
  completeFeature: {
    fontSize: 14,
    opacity: 0.8,
  },
  completeSpinner: {
    marginTop: 32,
  },
});
