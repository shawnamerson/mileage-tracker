import React, { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Modal,
  View,
  TextInput,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LoadingAnimation, LoadingSpinner } from '@/components/LoadingAnimation';
import { TripDiagnostic } from '@/components/TripDiagnostic';
import { Colors, useColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/Design';
import {
  startAutoTracking,
  stopAutoTracking,
  isAutoTrackingEnabled,
  isAutoTrackingActive,
  setDefaultPurpose,
  getDefaultPurpose,
} from '@/services/autoTracking';
import {
  areNotificationsEnabled,
  setNotificationsEnabled,
  initializeNotifications,
} from '@/services/notificationService';
import { getActiveTrip, isTrackingActive } from '@/services/backgroundTracking';
import * as Location from 'expo-location';
import { getAllTrips } from '@/services/tripService';
import {
  getAllRates,
  setRateForYear,
  getRateForYear,
  MileageRate,
} from '@/services/mileageRateService';
import {
  exportTripsToCSV,
  exportTripsToJSON,
  exportTaxSummary,
} from '@/services/exportService';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { getTrialDaysRemaining } from '@/services/authService';
import { restorePurchases } from '@/services/subscriptionService';

export default function SettingsScreen() {
  const colors = useColors();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(false);
  const [autoTrackingActive, setAutoTrackingActive] = useState(false);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [defaultPurpose, setDefaultPurposeState] = useState<
    'business' | 'personal' | 'medical' | 'charity' | 'other'
  >('business');
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState({
    hasLocationPermission: false,
    hasBackgroundPermission: false,
    activeTrip: null as any,
    isTracking: false,
  });
  const [mileageRates, setMileageRates] = useState<MileageRate[]>([]);
  const [showRateModal, setShowRateModal] = useState(false);
  const [editYear, setEditYear] = useState(new Date().getFullYear());
  const [editRate, setEditRate] = useState('0.70');

  const purposes = ['business', 'personal', 'medical', 'charity', 'other'] as const;

  useFocusEffect(
    React.useCallback(() => {
      loadSettings();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const loadSettings = async () => {
    try {
      console.log('[Settings] Loading settings...');

      // Add timeout protection for Expo Go and slow connections
      const settingsPromise = (async () => {
        const enabled = await isAutoTrackingEnabled();
        const active = await isAutoTrackingActive();
        const purpose = await getDefaultPurpose();
        const notifEnabled = await areNotificationsEnabled();
        const rates = await getAllRates();

        setAutoTrackingEnabled(enabled);
        setAutoTrackingActive(active);
        setDefaultPurposeState(purpose);
        setNotificationsEnabledState(notifEnabled);
        setMileageRates(rates);

        // Initialize notifications on first load
        await initializeNotifications();

        // Load diagnostic info
        await loadDiagnosticInfo();
      })();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => {
          console.log('[Settings] Settings load timeout - using defaults');
          reject(new Error('Timeout'));
        }, 5000)
      );

      await Promise.race([settingsPromise, timeoutPromise]);
      console.log('[Settings] Settings loaded successfully');
    } catch (error) {
      console.error('[Settings] Error loading settings:', error);
      // Use default values on timeout or error
      setAutoTrackingEnabled(false);
      setAutoTrackingActive(false);
      setDefaultPurposeState('business');
      setNotificationsEnabledState(false);
      setMileageRates([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDiagnosticInfo = async () => {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      const background = await Location.getBackgroundPermissionsAsync();
      const activeTrip = await getActiveTrip();
      const tracking = await isTrackingActive();

      setDiagnosticInfo({
        hasLocationPermission: foreground.granted,
        hasBackgroundPermission: background.granted,
        activeTrip,
        isTracking: tracking,
      });
    } catch (error) {
      console.error('Error loading diagnostic info:', error);
    }
  };

  const handleToggleAutoTracking = async (value: boolean) => {
    setLoading(true);
    try {
      if (value) {
        const started = await startAutoTracking();
        if (started) {
          setAutoTrackingEnabled(true);
          setAutoTrackingActive(true);
          Alert.alert(
            'Auto-Tracking Enabled',
            'The app will now automatically detect and track your trips. Drive detection starts at 5+ mph and trips end after 3 minutes of being stationary.'
          );
        } else {
          Alert.alert(
            'Permission Required',
            'Background location access is required for automatic trip tracking. Please grant permission in your device settings.'
          );
        }
      } else {
        await stopAutoTracking();
        setAutoTrackingEnabled(false);
        setAutoTrackingActive(false);
        Alert.alert('Auto-Tracking Disabled', 'Automatic trip detection has been turned off.');
      }
    } catch (error) {
      console.error('Error toggling auto-tracking:', error);
      Alert.alert('Error', 'Failed to toggle auto-tracking');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePurpose = async (
    purpose: 'business' | 'personal' | 'medical' | 'charity' | 'other'
  ) => {
    try {
      await setDefaultPurpose(purpose);
      setDefaultPurposeState(purpose);
    } catch (error) {
      console.error('Error changing purpose:', error);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const trips = await getAllTrips();
      if (trips.length === 0) {
        Alert.alert('No Data', 'You have no trips to export');
        return;
      }
      await exportTripsToCSV(trips);
      Alert.alert('Success', 'Trips exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      Alert.alert('Error', 'Failed to export trips');
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const trips = await getAllTrips();
      if (trips.length === 0) {
        Alert.alert('No Data', 'You have no trips to export');
        return;
      }
      await exportTripsToJSON(trips);
      Alert.alert('Success', 'Trips exported successfully');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      Alert.alert('Error', 'Failed to export trips');
    } finally {
      setExporting(false);
    }
  };

  const handleExportTaxSummary = async () => {
    setExporting(true);
    try {
      const trips = await getAllTrips();
      if (trips.length === 0) {
        Alert.alert('No Data', 'You have no trips to export');
        return;
      }
      await exportTaxSummary(trips);
      Alert.alert('Success', 'Tax summary exported successfully');
    } catch (error) {
      console.error('Error exporting tax summary:', error);
      Alert.alert('Error', 'Failed to export tax summary');
    } finally {
      setExporting(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    try {
      await setNotificationsEnabled(value);
      setNotificationsEnabledState(value);

      if (value) {
        Alert.alert(
          'Trip Notifications Enabled',
          'You will receive a notification when a trip is automatically recorded. You can change the trip purpose or delete it if you were a passenger.'
        );
      } else {
        Alert.alert(
          'Trip Notifications Disabled',
          'You will no longer receive notifications when trips are recorded.'
        );
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('Error', 'Failed to toggle notifications. Please check notification permissions in your device settings.');
    }
  };

  const handleAddOrEditRate = async (year: number) => {
    try {
      const currentRate = await getRateForYear(year);
      setEditYear(year);
      setEditRate(currentRate.toFixed(2));
      setShowRateModal(true);
    } catch (error) {
      console.error('Error loading rate:', error);
      setEditYear(year);
      setEditRate('0.70');
      setShowRateModal(true);
    }
  };

  const handleSaveRate = async () => {
    try {
      const rate = parseFloat(editRate);
      if (isNaN(rate) || rate < 0 || rate > 10) {
        Alert.alert('Invalid Rate', 'Please enter a valid rate between $0.00 and $10.00');
        return;
      }

      await setRateForYear(editYear, rate);
      setShowRateModal(false);
      await loadSettings();
      Alert.alert('Success', `Mileage rate for ${editYear} set to $${rate.toFixed(2)}/mile`);
    } catch (error) {
      console.error('Error saving rate:', error);
      Alert.alert('Error', 'Failed to save mileage rate');
    }
  };


  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <LoadingAnimation text="Loading settings..." />
      </ThemedView>
    );
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.header}>
          <ThemedText type="title">Settings</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>Configure automatic trip tracking</ThemedText>

          <TouchableOpacity
            style={[styles.quickStartButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowQuickStart(true)}
          >
            <ThemedText style={[styles.quickStartButtonText, { color: colors.textInverse }]}>📘 Quick Start Guide</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        {/* Account Section */}
        <ThemedView style={[styles.section, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Account</ThemedText>

          <ThemedView style={styles.accountInfo}>
            <ThemedView style={styles.accountRow}>
              <ThemedText style={[styles.accountLabel, { color: colors.textSecondary }]}>Email</ThemedText>
              <ThemedText style={styles.accountValue}>{user?.email}</ThemedText>
            </ThemedView>

            {profile && profile.subscription_status === 'trial' && (
              <ThemedView style={styles.accountRow}>
                <ThemedText style={[styles.accountLabel, { color: colors.textSecondary }]}>Trial Status</ThemedText>
                <ThemedText style={[styles.accountValue, { color: colors.success }]}>
                  {getTrialDaysRemaining(profile)} days remaining
                </ThemedText>
              </ThemedView>
            )}

            {profile && profile.subscription_status === 'active' && (
              <ThemedView style={styles.accountRow}>
                <ThemedText style={[styles.accountLabel, { color: colors.textSecondary }]}>Subscription</ThemedText>
                <ThemedText style={[styles.accountValue, { color: colors.success }]}>
                  ✓ Active
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>

          {/* Subscription Management */}
          {profile && profile.subscription_status === 'active' && (
            <TouchableOpacity
              style={[styles.manageButton, { borderColor: colors.primary }]}
              onPress={() => {
                Alert.alert(
                  'Manage Subscription',
                  'To manage your subscription, go to Settings → Apple ID → Subscriptions on your device.',
                  [{ text: 'OK' }]
                );
              }}
            >
              <ThemedText style={[styles.manageButtonText, { color: colors.primary }]}>
                Manage Subscription
              </ThemedText>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.restorePurchasesButton, { borderColor: colors.primary }]}
            onPress={async () => {
              setLoading(true);
              try {
                const { success, error } = await restorePurchases();

                if (error) {
                  Alert.alert('Restore Failed', error.message);
                  return;
                }

                if (success) {
                  await refreshProfile();
                  Alert.alert('Success', 'Your purchases have been restored!');
                }
              } catch (error) {
                console.error('Restore error:', error);
                Alert.alert('Error', 'Failed to restore purchases');
              } finally {
                setLoading(false);
              }
            }}
          >
            <ThemedText style={[styles.restorePurchasesButtonText, { color: colors.primary }]}>
              Restore Purchases
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signOutButton, { borderColor: colors.error }]}
            onPress={async () => {
              Alert.alert(
                'Sign Out',
                'Are you sure you want to sign out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                      await signOut();
                    },
                  },
                ]
              );
            }}
          >
            <ThemedText style={[styles.signOutButtonText, { color: colors.error }]}>
              Sign Out
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

      <ThemedView style={[styles.section, { backgroundColor: colors.surface }]}>
        <ThemedView style={styles.settingRow}>
          <ThemedView style={styles.settingInfo}>
            <ThemedText type="subtitle">Automatic Tracking</ThemedText>
            <ThemedText style={[styles.settingDescription, { color: colors.textSecondary }]}>
              Automatically detect and track trips when driving
            </ThemedText>
          </ThemedView>
          <Switch
            value={autoTrackingEnabled}
            onValueChange={handleToggleAutoTracking}
            disabled={loading}
          />
        </ThemedView>

        {autoTrackingActive && (
          <ThemedView style={[styles.statusBanner, { backgroundColor: colors.surface, borderColor: colors.success }]}>
            <ThemedText style={[styles.statusText, { color: colors.success }]}>
              ✓ Auto-tracking is active and monitoring
            </ThemedText>
          </ThemedView>
        )}

        {/* Diagnostic Section */}
        <TouchableOpacity
          style={[styles.diagnosticToggle, { backgroundColor: colors.surface, borderColor: colors.primary }]}
          onPress={() => {
            setShowDiagnostics(!showDiagnostics);
            if (!showDiagnostics) loadDiagnosticInfo();
          }}
        >
          <ThemedText style={[styles.diagnosticToggleText, { color: colors.primary }]}>
            {showDiagnostics ? '▼' : '▶'} System Status & Diagnostics
          </ThemedText>
        </TouchableOpacity>

        {showDiagnostics && (
          <ThemedView style={[styles.diagnosticSection, { backgroundColor: colors.surfaceLight }]}>
            <ThemedView style={styles.diagnosticRow}>
              <ThemedText style={styles.diagnosticLabel}>Auto-Tracking:</ThemedText>
              <ThemedText style={[styles.diagnosticValue, autoTrackingEnabled ? styles.diagnosticSuccess : styles.diagnosticError]}>
                {autoTrackingEnabled ? '✓ Enabled' : '✗ Disabled'}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.diagnosticRow}>
              <ThemedText style={styles.diagnosticLabel}>Location Permission:</ThemedText>
              <ThemedText style={[styles.diagnosticValue, diagnosticInfo.hasLocationPermission ? styles.diagnosticSuccess : styles.diagnosticError]}>
                {diagnosticInfo.hasLocationPermission ? '✓ Granted' : '✗ Not Granted'}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.diagnosticRow}>
              <ThemedText style={styles.diagnosticLabel}>Background Permission:</ThemedText>
              <ThemedText style={[styles.diagnosticValue, diagnosticInfo.hasBackgroundPermission ? styles.diagnosticSuccess : styles.diagnosticError]}>
                {diagnosticInfo.hasBackgroundPermission ? '✓ Always Allowed' : '✗ Not Allowed'}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.diagnosticRow}>
              <ThemedText style={styles.diagnosticLabel}>Active Trip:</ThemedText>
              <ThemedText style={[styles.diagnosticValue, diagnosticInfo.isTracking ? styles.diagnosticWarning : styles.diagnosticInfo]}>
                {diagnosticInfo.isTracking ? (
                  `Yes (${diagnosticInfo.activeTrip?.distance?.toFixed(2) || '0.00'} mi)`
                ) : (
                  'No'
                )}
              </ThemedText>
            </ThemedView>

            {diagnosticInfo.isTracking && diagnosticInfo.activeTrip && (
              <>
                <ThemedView style={styles.diagnosticRow}>
                  <ThemedText style={styles.diagnosticLabel}>From:</ThemedText>
                  <ThemedText style={styles.diagnosticValue} numberOfLines={1}>
                    {diagnosticInfo.activeTrip.start_location}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.diagnosticRow}>
                  <ThemedText style={styles.diagnosticLabel}>Duration:</ThemedText>
                  <ThemedText style={styles.diagnosticValue}>
                    {Math.floor((Date.now() - diagnosticInfo.activeTrip.start_time) / 60000)} min
                  </ThemedText>
                </ThemedView>
              </>
            )}

            <ThemedView style={styles.diagnosticHelpBox}>
              <ThemedText style={styles.diagnosticHelpTitle}>Quick Checks:</ThemedText>
              <ThemedText style={styles.diagnosticHelpText}>
                {!autoTrackingEnabled && '• Enable Auto-Tracking toggle above\n'}
                {!diagnosticInfo.hasLocationPermission && '• Grant location permission in device settings\n'}
                {!diagnosticInfo.hasBackgroundPermission && '• Change location to "Always Allow" in device settings\n'}
                {autoTrackingEnabled && diagnosticInfo.hasBackgroundPermission && !diagnosticInfo.isTracking && '• Drive at 5+ mph to start a trip\n'}
                {diagnosticInfo.isTracking && '• Stop for 3 minutes to end the trip\n'}
                {autoTrackingEnabled && diagnosticInfo.hasBackgroundPermission && '✓ System ready to track trips'}
              </ThemedText>
            </ThemedView>

            <TouchableOpacity
              style={styles.diagnosticRefreshButton}
              onPress={loadDiagnosticInfo}
            >
              <ThemedText style={styles.diagnosticRefreshText}>🔄 Refresh Status</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}

        {/* Notifications Toggle */}
        {autoTrackingEnabled && (
          <ThemedView style={[styles.settingRow, { marginTop: Spacing.lg }]}>
            <ThemedView style={styles.settingInfo}>
              <ThemedText type="defaultSemiBold">Trip Notifications</ThemedText>
              <ThemedText style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Get notified when trips are recorded
              </ThemedText>
            </ThemedView>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              disabled={loading}
            />
          </ThemedView>
        )}
      </ThemedView>

      {autoTrackingEnabled && (
        <>
          <ThemedView style={[styles.section, { backgroundColor: colors.surface }]}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Default Purpose
            </ThemedText>
            <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
              Auto-tracked trips will be assigned this purpose by default
            </ThemedText>

            <ThemedView style={styles.purposeContainer}>
              {purposes.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.purposeButton,
                    { borderColor: colors.primary },
                    defaultPurpose === p && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => handleChangePurpose(p)}
                >
                  <ThemedText
                    style={[
                      styles.purposeText,
                      { color: colors.primary },
                      defaultPurpose === p && { color: colors.textInverse }
                    ]}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ThemedView>
          </ThemedView>

          <ThemedView style={[styles.infoSection, { backgroundColor: colors.surface }]}>
            <ThemedText type="subtitle" style={styles.infoTitle}>
              How It Works
            </ThemedText>

            <ThemedView style={styles.infoItem}>
              <ThemedText style={styles.infoLabel}>• Start Detection:</ThemedText>
              <ThemedText style={styles.infoText}>
                Trip starts when speed exceeds 5 mph
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.infoItem}>
              <ThemedText style={styles.infoLabel}>• Stop Detection:</ThemedText>
              <ThemedText style={styles.infoText}>
                Trip ends after 3 minutes stationary
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.infoItem}>
              <ThemedText style={styles.infoLabel}>• Minimum Distance:</ThemedText>
              <ThemedText style={styles.infoText}>
                No minimum - all trips are saved
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.infoItem}>
              <ThemedText style={styles.infoLabel}>• Battery Impact:</ThemedText>
              <ThemedText style={styles.infoText}>
                Location checked every 5 seconds or 20 meters
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedView style={[styles.warningSection, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
            <ThemedText style={[styles.warningText, { color: colors.textSecondary }]}>
              ⚠️ Auto-tracking requires background location access. Make sure to enable &quot;Always
              Allow&quot; in your device&apos;s location permissions.
            </ThemedText>
          </ThemedView>
        </>
      )}

      <ThemedView style={[styles.section, { backgroundColor: colors.surface }]}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Data Export
        </ThemedText>
        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Export your trip data for tax purposes or record keeping
        </ThemedText>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleExportCSV}
          disabled={exporting}
        >
          {exporting ? (
            <LoadingSpinner color="#fff" size={20} />
          ) : (
            <ThemedText style={[styles.buttonText, { color: colors.textInverse }]}>Export as CSV</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, { borderColor: colors.primary }]}
          onPress={handleExportJSON}
          disabled={exporting}
        >
          {exporting ? (
            <LoadingSpinner color={colors.primary} size={20} />
          ) : (
            <ThemedText style={[styles.secondaryButtonText, { color: colors.primary }]}>Export as JSON</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, { borderColor: colors.primary }]}
          onPress={handleExportTaxSummary}
          disabled={exporting}
        >
          {exporting ? (
            <LoadingSpinner color={colors.primary} size={20} />
          ) : (
            <ThemedText style={[styles.secondaryButtonText, { color: colors.primary }]}>Export Tax Summary</ThemedText>
          )}
        </TouchableOpacity>
      </ThemedView>

      <ThemedView style={[styles.section, { backgroundColor: colors.surface }]}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          🔍 Trip Diagnostic
        </ThemedText>
        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Check trip status, queue, and AsyncStorage
        </ThemedText>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, { borderColor: colors.primary }]}
          onPress={() => setShowDiagnostic(true)}
        >
          <ThemedText style={[styles.secondaryButtonText, { color: colors.primary }]}>Run Diagnostic</ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <ThemedView style={[styles.section, { backgroundColor: colors.surface }]}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          IRS Mileage Rates
        </ThemedText>
        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Official IRS standard mileage rates are automatically configured. Your trips are calculated using the rate from their calendar year. You can override rates if needed.
        </ThemedText>

        {mileageRates.length > 0 ? (
          <ThemedView style={styles.ratesContainer}>
            {mileageRates.map((rate) => (
              <TouchableOpacity
                key={rate.year}
                style={[styles.rateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handleAddOrEditRate(rate.year)}
              >
                <ThemedView style={styles.rateInfo}>
                  <ThemedText type="defaultSemiBold">{rate.year}</ThemedText>
                  <ThemedText style={[styles.rateValue, { color: colors.primary }]}>${rate.rate.toFixed(3)}/mile</ThemedText>
                </ThemedView>
                <ThemedText style={[styles.editIcon, { color: colors.textSecondary }]}>✎</ThemedText>
              </TouchableOpacity>
            ))}
          </ThemedView>
        ) : (
          <ThemedText style={[styles.noRatesText, { color: colors.textSecondary }]}>Loading rates...</ThemedText>
        )}

        <ThemedView style={[styles.rateInfoBox, { backgroundColor: colors.surfaceLight, borderLeftColor: colors.info }]}>
          <ThemedText style={[styles.rateInfoText, { color: colors.textSecondary }]}>
            ℹ️ Rates are pre-configured with official IRS standard mileage rates for business use. Tap any year to customize if needed.
          </ThemedText>
        </ThemedView>
      </ThemedView>

      </ScrollView>

      {/* Quick Start Guide Modal */}
      <Modal
        visible={showQuickStart}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowQuickStart(false)}
      >
        <ThemedView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <ThemedText type="title">Quick Start Guide</ThemedText>
            <TouchableOpacity onPress={() => setShowQuickStart(false)}>
              <ThemedText style={[styles.modalClose, { color: colors.primary }]}>Done</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <ThemedView style={styles.guideSection}>
              <ThemedText style={styles.guideStepNumber}>Step 1</ThemedText>
              <ThemedText type="subtitle" style={styles.guideTitle}>
                Enable Auto-Tracking
              </ThemedText>
              <ThemedText style={styles.guideText}>
                Toggle &quot;Automatic Tracking&quot; ON in Settings. This allows the app to detect when you start driving.
              </ThemedText>
              <ThemedView style={styles.guideTip}>
                <ThemedText style={styles.guideTipText}>
                  💡 You&apos;ll be asked to grant location permissions. Choose &quot;Always Allow&quot; for background tracking.
                </ThemedText>
              </ThemedView>
            </ThemedView>

            <ThemedView style={styles.guideSection}>
              <ThemedText style={styles.guideStepNumber}>Step 2</ThemedText>
              <ThemedText type="subtitle" style={styles.guideTitle}>
                Take a Test Drive
              </ThemedText>
              <ThemedText style={styles.guideText}>
                Go for a short drive to test the system:{'\n\n'}
                1. Drive at 5+ mph - trip starts automatically{'\n'}
                2. Park and wait 3 minutes - trip ends automatically{'\n'}
                3. Check Dashboard or History tab to see your trip
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.guideSection}>
              <ThemedText style={styles.guideStepNumber}>Step 3</ThemedText>
              <ThemedText type="subtitle" style={styles.guideTitle}>
                Verify It&apos;s Working
              </ThemedText>
              <ThemedText style={styles.guideText}>
                Use the &quot;System Status &amp; Diagnostics&quot; section in Settings to check:{'\n\n'}
                • Auto-Tracking: ✓ Enabled{'\n'}
                • Location Permission: ✓ Granted{'\n'}
                • Background Permission: ✓ Always Allowed{'\n'}
                • Active Trip: Shows when driving
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.guideSection}>
              <ThemedText type="subtitle" style={styles.guideTitle}>
                How Trips Are Saved
              </ThemedText>
              <ThemedText style={styles.guideText}>
                • <ThemedText type="defaultSemiBold">Start:</ThemedText> Speed exceeds 5 mph{'\n'}
                • <ThemedText type="defaultSemiBold">End:</ThemedText> Stopped for 3 minutes{'\n'}
                • <ThemedText type="defaultSemiBold">Minimum:</ThemedText> No minimum - all trips saved{'\n'}
                • <ThemedText type="defaultSemiBold">Purpose:</ThemedText> Set to &quot;Business&quot; by default{'\n'}
                • <ThemedText type="defaultSemiBold">Appears:</ThemedText> Immediately in Dashboard & History
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.guideTroubleshoot}>
              <ThemedText type="subtitle" style={styles.guideTitle}>
                Troubleshooting
              </ThemedText>
              <ThemedText style={styles.guideText}>
                <ThemedText type="defaultSemiBold">Trip not appearing?</ThemedText>{'\n'}
                • Check if trip is still active (wait 3 min after stopping){'\n'}
                • Verify permissions are set to &quot;Always Allow&quot;{'\n'}
                • Ensure you exceeded 5 mph during the drive{'\n'}
                • Check &quot;System Status &amp; Diagnostics&quot; in Settings{'\n\n'}

                <ThemedText type="defaultSemiBold">Battery concerns?</ThemedText>{'\n'}
                • Location checks every 5 seconds or 20 meters{'\n'}
                • Modern phones handle this efficiently{'\n'}
                • iOS optimizes background location services
              </ThemedText>
            </ThemedView>

            <TouchableOpacity
              style={styles.guideCloseButton}
              onPress={() => setShowQuickStart(false)}
            >
              <ThemedText style={styles.guideCloseButtonText}>Got It!</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </ThemedView>
      </Modal>

      {/* Trip Diagnostic Modal */}
      <Modal
        visible={showDiagnostic}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDiagnostic(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <ThemedText type="title">🔍 Trip Diagnostic</ThemedText>
            <TouchableOpacity onPress={() => setShowDiagnostic(false)}>
              <ThemedText style={{fontSize: 32, fontWeight: '300'}}>×</ThemedText>
            </TouchableOpacity>
          </View>
          <TripDiagnostic />
        </View>
      </Modal>

      {/* Mileage Rate Edit Modal */}
      <Modal
        visible={showRateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRateModal(false)}
      >
        <ThemedView style={styles.rateModalOverlay}>
          <ThemedView style={[styles.rateModalContent, { backgroundColor: colors.surface }]}>
            <ThemedText type="subtitle" style={[styles.modalTitle, { color: colors.text }]}>
              Set Mileage Rate for {editYear}
            </ThemedText>

            <ThemedText style={[styles.rateModalDescription, { color: colors.textSecondary }]}>
              Override the mileage rate for {editYear}. Leave as-is to use the official IRS standard rate.
            </ThemedText>

            <ThemedView style={[styles.rateInputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <ThemedText style={[styles.dollarSign, { color: colors.text }]}>$</ThemedText>
              <TextInput
                style={[styles.rateInput, { color: colors.text }]}
                value={editRate}
                onChangeText={setEditRate}
                keyboardType="decimal-pad"
                placeholder="0.70"
                placeholderTextColor={colors.textTertiary}
              />
              <ThemedText style={[styles.perMile, { color: colors.textSecondary }]}>/mile</ThemedText>
            </ThemedView>

            <ThemedView style={styles.rateModalButtons}>
              <TouchableOpacity
                style={[styles.rateCancelButton, { borderColor: colors.primary }]}
                onPress={() => setShowRateModal(false)}
              >
                <ThemedText style={[styles.rateCancelButtonText, { color: colors.primary }]}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rateSaveButton, { backgroundColor: colors.primary }]}
                onPress={handleSaveRate}
              >
                <ThemedText style={[styles.rateSaveButtonText, { color: colors.textInverse }]}>Save</ThemedText>
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Modal>
    </>
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
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    ...Shadows.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingDescription: {
    marginTop: Spacing.xs,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  statusBanner: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.success,
    ...Shadows.sm,
  },
  statusText: {
    color: Colors.success,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  sectionDescription: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  purposeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  purposeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  purposeButtonActive: {
    backgroundColor: Colors.primary,
  },
  purposeText: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  purposeTextActive: {
    color: Colors.textInverse,
  },
  infoSection: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  infoTitle: {
    marginBottom: Spacing.md,
  },
  infoItem: {
    marginBottom: Spacing.md,
  },
  infoLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xs,
    color: Colors.text,
  },
  infoText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
  },
  warningSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.warning,
    ...Shadows.sm,
  },
  warningText: {
    fontSize: Typography.sm,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  button: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.md,
  },
  buttonText: {
    color: Colors.textInverse,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    ...Shadows.sm,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  backupInfo: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  backupInfoLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    width: '45%',
  },
  backupInfoValue: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.text,
    width: '50%',
  },
  deviceList: {
    marginTop: Spacing.md,
  },
  deviceListTitle: {
    marginBottom: Spacing.md,
    fontSize: Typography.sm,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceDate: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  removeButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.error,
    ...Shadows.sm,
  },
  removeButtonText: {
    color: Colors.error,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
  scannedDeviceItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.success,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  scannedDeviceItemConnected: {
    borderWidth: 2,
    backgroundColor: Colors.surfaceLight,
  },
  scannedDeviceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scannedDeviceInfo: {
    flex: 1,
  },
  deviceId: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    fontFamily: 'monospace',
  },
  connectedBadgeSettings: {
    backgroundColor: Colors.success,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginLeft: Spacing.sm,
  },
  connectedBadgeTextSettings: {
    color: Colors.textInverse,
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
  },
  diagnosticToggle: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    ...Shadows.sm,
  },
  diagnosticToggleText: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  diagnosticSection: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    gap: Spacing.sm,
  },
  diagnosticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  diagnosticLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    flex: 1,
    color: Colors.text,
  },
  diagnosticValue: {
    fontSize: Typography.sm,
    flex: 1,
    textAlign: 'right',
    fontWeight: Typography.medium,
  },
  diagnosticSuccess: {
    color: Colors.success,
    fontWeight: Typography.semibold,
  },
  diagnosticError: {
    color: Colors.error,
    fontWeight: Typography.semibold,
  },
  diagnosticWarning: {
    color: Colors.warning,
    fontWeight: Typography.semibold,
  },
  diagnosticInfo: {
    color: Colors.textSecondary,
  },
  diagnosticHelpBox: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  diagnosticHelpTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    marginBottom: Spacing.xs,
    color: Colors.text,
  },
  diagnosticHelpText: {
    fontSize: Typography.xs,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  diagnosticRefreshButton: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    ...Shadows.sm,
  },
  diagnosticRefreshText: {
    color: Colors.textInverse,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  quickStartButton: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    ...Shadows.md,
  },
  quickStartButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Spacing.xxl,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalClose: {
    color: Colors.primary,
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  guideSection: {
    marginBottom: Spacing.xl,
  },
  guideStepNumber: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  guideTitle: {
    marginBottom: Spacing.md,
  },
  guideText: {
    fontSize: Typography.base,
    lineHeight: 24,
    color: Colors.textSecondary,
  },
  guideTip: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
    ...Shadows.sm,
  },
  guideTipText: {
    fontSize: Typography.sm,
    lineHeight: 20,
    color: Colors.text,
  },
  guideTroubleshoot: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.warning,
    ...Shadows.md,
  },
  guideCloseButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
    padding: Spacing.lg,
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.lg,
  },
  guideCloseButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
  ratesContainer: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  rateInfo: {
    flex: 1,
  },
  rateValue: {
    fontSize: Typography.sm,
    color: Colors.primary,
    fontWeight: Typography.semibold,
    marginTop: Spacing.xs,
  },
  editIcon: {
    fontSize: Typography.lg,
    color: Colors.textSecondary,
    marginLeft: Spacing.md,
  },
  noRatesText: {
    marginTop: Spacing.md,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  rateInfoBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  rateInfoText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  warningBox: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  warningTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.warning,
    marginBottom: Spacing.sm,
  },
  backupWarningText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  backupStatusBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  backupStatusLabel: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  backupStatusValue: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.success,
    marginBottom: Spacing.xs,
  },
  backupTripCount: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  restoreInfoBox: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.info,
  },
  restoreInfoTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  restoreInfoText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  rateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  rateModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.xl,
  },
  modalTitle: {
    marginBottom: Spacing.md,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.text,
  },
  rateModalDescription: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dollarSign: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.text,
    marginRight: Spacing.xs,
  },
  rateInput: {
    flex: 1,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.text,
    padding: 0,
  },
  perMile: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  rateModalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  rateCancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  rateCancelButtonText: {
    color: Colors.primary,
    fontWeight: Typography.semibold,
    fontSize: Typography.sm,
  },
  rateSaveButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  rateSaveButtonText: {
    color: Colors.textInverse,
    fontWeight: Typography.semibold,
    fontSize: Typography.sm,
  },
  accountInfo: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  accountLabel: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  accountValue: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.text,
  },
  signOutButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  signOutButtonText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  manageButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  manageButtonText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
  restorePurchasesButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  restorePurchasesButtonText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
});
