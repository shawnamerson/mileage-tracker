import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/Design';
import { getMigrationStatus, performFullMigration, MigrationStatus } from '@/services/migrationService';
import { useRouter } from 'expo-router';

interface MigrationBannerProps {
  onDismiss?: () => void;
}

export function MigrationBanner({ onDismiss }: MigrationBannerProps) {
  const colors = useColors();
  const router = useRouter();
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const migrationStatus = await getMigrationStatus();
      setStatus(migrationStatus);
    } catch (error) {
      console.error('[MigrationBanner] Error loading status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    Alert.alert(
      'Start Migration?',
      'This will export all your trips from the cloud to your device. This is safe and will not delete any data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Migration',
          onPress: async () => {
            setMigrating(true);
            try {
              const result = await performFullMigration();

              if (result.success) {
                Alert.alert(
                  'Migration Complete! ✅',
                  `Successfully migrated ${result.importedCount || 0} trips to local storage. Your data is now 100% offline.`,
                  [{ text: 'OK', onPress: loadStatus }]
                );
              } else {
                Alert.alert(
                  'Migration Failed',
                  result.error || 'Unknown error occurred',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              Alert.alert(
                'Migration Error',
                error instanceof Error ? error.message : 'Unknown error',
                [{ text: 'OK' }]
              );
            } finally {
              setMigrating(false);
            }
          },
        },
      ]
    );
  };

  const handleLearnMore = () => {
    router.push('/(tabs)/settings');
  };

  // Don't show banner if migration is complete or loading
  if (loading || !status || status.isComplete) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.info }]}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>📱</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textInverse }]}>
          MileMate is going offline-first!
        </Text>
        <Text style={[styles.description, { color: colors.textInverse }]}>
          Your data will stay on your device for better privacy and reliability.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleMigrate}
            disabled={migrating}
          >
            {migrating ? (
              <ActivityIndicator size="small" color={colors.info} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.info }]}>
                Migrate Now
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleLearnMore}
            disabled={migrating}
          >
            <Text style={[styles.buttonText, { color: colors.textInverse }]}>
              Learn More
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {onDismiss && !migrating && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
        >
          <Text style={[styles.dismissText, { color: colors.textInverse }]}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  icon: {
    fontSize: 32,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: Typography.sm,
    marginBottom: Spacing.md,
    opacity: 0.9,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  button: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  dismissButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    padding: Spacing.xs,
  },
  dismissText: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
  },
});
