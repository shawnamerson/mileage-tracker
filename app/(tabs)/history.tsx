import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { getAllTrips, deleteTrip, updateTrip, Trip } from '@/services/tripService';
import { getLocalTrips, deleteLocalTrip, updateLocalTrip, LocalTrip } from '@/services/localDatabase';
import { onSyncComplete } from '@/services/syncService';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, useColors, Spacing, BorderRadius, Shadows, Typography } from '@/constants/Design';

export default function HistoryScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trips, setTrips] = useState<LocalTrip[]>([]);
  const [filter, setFilter] = useState<'all' | 'business' | 'personal'>('all');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTrip, setEditingTrip] = useState<LocalTrip | null>(null);
  const [editPurpose, setEditPurpose] = useState<'business' | 'personal' | 'medical' | 'charity' | 'other'>('business');
  const [editNotes, setEditNotes] = useState('');

  const purposes = ['business', 'personal', 'medical', 'charity', 'other'] as const;

  const loadTrips = async () => {
    console.log('[History] loadTrips called, user:', user?.id);
    if (!user) {
      console.log('[History] No user found, setting loading=false');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      console.log('[History] Loading from local SQLite for user:', user.id);

      // Load from local database (fast, always available)
      const localTrips = await getLocalTrips(user.id);

      console.log('[History] ✅ Loaded from local SQLite:', localTrips.length, 'trips');
      if (localTrips.length === 0) {
        console.log('[History] ⚠️ No trips found in local SQLite! This could mean:');
        console.log('[History]   1. No trips have been created yet');
        console.log('[History]   2. Sync has not run yet');
        console.log('[History]   3. Downloaded trips were not saved to local SQLite');
      }

      setTrips(localTrips);
    } catch (error) {
      console.error('[History] Error loading trips:', error);
      // Use empty array on error
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Remove redundant useEffect - useFocusEffect handles both initial load and focus
  useFocusEffect(
    React.useCallback(() => {
      loadTrips();
    }, [user])
  );

  // Auto-reload when sync completes
  useEffect(() => {
    if (!user) return;

    console.log('[History] Subscribing to sync completion events');
    const unsubscribe = onSyncComplete(() => {
      console.log('[History] Sync completed - reloading trips...');
      loadTrips();
    });

    return () => {
      console.log('[History] Unsubscribing from sync completion events');
      unsubscribe();
    };
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips();
  };

  const handleEditTrip = (trip: LocalTrip) => {
    setEditingTrip(trip);
    setEditPurpose(trip.purpose);
    setEditNotes(trip.notes || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTrip || !editingTrip.id) return;

    try {
      // Update in local database first
      await updateLocalTrip(editingTrip.id, {
        purpose: editPurpose,
        notes: editNotes,
      });

      // Also update in Supabase (in background, log errors but don't block)
      updateTrip(editingTrip.id, {
        purpose: editPurpose,
        notes: editNotes,
      }).catch(error => {
        console.error('[History] Failed to update in Supabase (will sync later):', error instanceof Error ? error.message : String(error));
        // Local update already succeeded, sync service will retry later
      });

      setEditModalVisible(false);
      setEditingTrip(null);
      loadTrips();
    } catch (error) {
      console.error('Error updating trip:', error);
      Alert.alert('Error', 'Failed to update trip');
    }
  };

  const handleDeleteTrip = (id: string) => {
    Alert.alert('Delete Trip', 'Are you sure you want to delete this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Delete from local database first
            await deleteLocalTrip(id);

            // Also delete from Supabase (in background, log errors but don't block)
            deleteTrip(id).catch(error => {
              console.error('[History] Failed to delete from Supabase (will sync later):', error instanceof Error ? error.message : String(error));
              // Local delete already succeeded, sync service will retry later
            });

            // Reload trips from local database
            loadTrips();
          } catch (error) {
            console.error('Error deleting trip:', error);
            Alert.alert('Error', 'Failed to delete trip');
          }
        },
      },
    ]);
  };

  const filteredTrips = trips.filter((trip) => {
    if (filter === 'all') return true;
    return trip.purpose === filter;
  });

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <LoadingAnimation text="Loading your trips..." />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Trip History</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { borderColor: colors.primary },
            filter === 'all' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setFilter('all')}
        >
          <ThemedText style={[
            styles.filterText,
            { color: colors.primary },
            filter === 'all' && { color: colors.textInverse }
          ]}>
            All
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { borderColor: colors.primary },
            filter === 'business' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setFilter('business')}
        >
          <ThemedText style={[
            styles.filterText,
            { color: colors.primary },
            filter === 'business' && { color: colors.textInverse }
          ]}>
            Business
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { borderColor: colors.primary },
            filter === 'personal' && { backgroundColor: colors.primary }
          ]}
          onPress={() => setFilter('personal')}
        >
          <ThemedText style={[
            styles.filterText,
            { color: colors.primary },
            filter === 'personal' && { color: colors.textInverse }
          ]}>
            Personal
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredTrips.length === 0 ? (
          <ThemedView style={[styles.emptyState, { backgroundColor: colors.surface }]}>
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>No trips found</ThemedText>
            <ThemedText style={[styles.emptySubtext, { color: colors.textTertiary }]}>
              Add your first trip using the Add Trip tab
            </ThemedText>
          </ThemedView>
        ) : (
          filteredTrips.map((trip) => (
            <ThemedView key={trip.id} style={[styles.tripCard, { backgroundColor: colors.surface }]}>
              <ThemedView style={styles.tripHeader}>
                <ThemedView style={styles.tripInfo}>
                  <ThemedText type="defaultSemiBold" numberOfLines={1} ellipsizeMode="tail">
                    {trip.start_location}
                  </ThemedText>
                  <ThemedText style={styles.arrow}>→</ThemedText>
                  <ThemedText type="defaultSemiBold" numberOfLines={1} ellipsizeMode="tail">
                    {trip.end_location}
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.tripDistance}>{trip.distance.toFixed(1)} mi</ThemedText>
              </ThemedView>

              <ThemedView style={styles.tripDetails}>
                <ThemedView style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Date:</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {new Date(trip.start_time).toLocaleDateString()}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Time:</ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {new Date(trip.start_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    -{' '}
                    {new Date(trip.end_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.detailRow}>
                  <ThemedText style={styles.detailLabel}>Purpose:</ThemedText>
                  <ThemedText style={[styles.detailValue, styles.purposeBadge]}>
                    {trip.purpose}
                  </ThemedText>
                </ThemedView>
                {trip.notes && (
                  <ThemedView style={styles.notesRow}>
                    <ThemedText style={styles.detailLabel}>Notes:</ThemedText>
                    <ThemedText style={styles.notesValue} numberOfLines={2} ellipsizeMode="tail">
                      {trip.notes}
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>

              <ThemedView style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEditTrip(trip)}
                >
                  <ThemedText style={styles.editButtonText}>Edit</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteTrip(trip.id!)}
                >
                  <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          ))
        )}
      </ScrollView>

      {/* Edit Trip Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <ThemedView style={styles.modalOverlay}>
          <ThemedView style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <ThemedText type="subtitle" style={[styles.modalTitle, { color: colors.text }]}>
              Edit Trip
            </ThemedText>

            {editingTrip && (
              <>
                <ThemedView style={styles.modalSection}>
                  <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>Route:</ThemedText>
                  <ThemedText style={[styles.modalRouteText, { color: colors.text }]}>
                    {editingTrip.start_location} → {editingTrip.end_location}
                  </ThemedText>
                </ThemedView>

                <ThemedView style={styles.modalSection}>
                  <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>Purpose:</ThemedText>
                  <ThemedView style={styles.purposeContainer}>
                    {purposes.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.purposeButton,
                          { borderColor: colors.primary },
                          editPurpose === p && { backgroundColor: colors.primary },
                        ]}
                        onPress={() => setEditPurpose(p)}
                      >
                        <ThemedText
                          style={[
                            styles.purposeText,
                            { color: colors.primary },
                            editPurpose === p && { color: colors.textInverse },
                          ]}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ThemedView>
                </ThemedView>

                <ThemedView style={styles.modalSection}>
                  <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>Notes:</ThemedText>
                  <TextInput
                    style={[
                      styles.notesInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.text
                      }
                    ]}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    placeholder="Add notes (optional)"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={3}
                  />
                </ThemedView>

                <ThemedView style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      { borderColor: colors.primary }
                    ]}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <ThemedText style={[styles.cancelButtonText, { color: colors.primary }]}>Cancel</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSaveEdit}
                  >
                    <ThemedText style={[styles.saveButtonText, { color: colors.textInverse }]}>Save Changes</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              </>
            )}
          </ThemedView>
        </ThemedView>
      </Modal>
    </ThemedView>
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
    opacity: 0.7,
    color: Colors.textSecondary,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    color: Colors.primary,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  filterTextActive: {
    color: Colors.textInverse,
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    marginTop: Spacing.xxl,
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    ...Shadows.md,
  },
  emptyText: {
    fontSize: Typography.lg,
    color: Colors.textSecondary,
    fontWeight: Typography.semibold,
  },
  emptySubtext: {
    marginTop: Spacing.sm,
    fontSize: Typography.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  tripCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    ...Shadows.md,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripInfo: {
    flex: 1,
    marginRight: 8,
  },
  arrow: {
    marginVertical: 4,
    opacity: 0.6,
  },
  tripDistance: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  tripDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notesRow: {
    flexDirection: 'column',
    gap: 4,
  },
  detailLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  purposeBadge: {
    textTransform: 'capitalize',
    color: '#007AFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  editButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  editButtonText: {
    color: Colors.textInverse,
    fontWeight: Typography.semibold,
    fontSize: Typography.sm,
  },
  deleteButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  deleteButtonText: {
    color: Colors.textInverse,
    fontWeight: Typography.semibold,
    fontSize: Typography.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.xl,
  },
  modalTitle: {
    marginBottom: Spacing.lg,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.text,
  },
  modalSection: {
    marginBottom: Spacing.lg,
  },
  modalLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  modalRouteText: {
    fontSize: Typography.base,
    color: Colors.text,
    fontWeight: Typography.medium,
  },
  purposeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  purposeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
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
  notesInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.base,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    color: Colors.primary,
    fontWeight: Typography.semibold,
    fontSize: Typography.sm,
  },
  saveButton: {
    flex: 1,
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  saveButtonText: {
    color: Colors.textInverse,
    fontWeight: Typography.semibold,
    fontSize: Typography.sm,
  },
});
