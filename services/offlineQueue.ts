// Offline queue operations - separate from sync to avoid circular dependencies
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from './tripTypes';

const SYNC_QUEUE_KEY = 'sync_queue';
const MAX_RETRY_ATTEMPTS = 3;

// Error types for better categorization
export enum SyncErrorType {
  NETWORK = 'network',
  SERVER = 'server',
  VALIDATION = 'validation',
  AUTH = 'auth',
  UNKNOWN = 'unknown',
}

export interface SyncError {
  type: SyncErrorType;
  message: string;
  retryable: boolean;
}

// Offline queue item
export interface QueuedOperation {
  id: string;
  type: 'upload' | 'delete' | 'create';
  trip: Trip;
  attempts: number;
  lastAttempt?: number;
  error?: SyncError;
}

/**
 * Get offline queue from storage
 */
export async function getQueue(): Promise<QueuedOperation[]> {
  try {
    const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error('[Offline Queue] Error loading queue:', error);
    return [];
  }
}

/**
 * Save offline queue to storage
 */
export async function saveQueue(queue: QueuedOperation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[Offline Queue] Error saving queue:', error);
  }
}

/**
 * Add operation to offline queue
 */
export async function addToQueue(
  type: 'upload' | 'delete' | 'create',
  trip: Trip
): Promise<void> {
  try {
    const queue = await getQueue();
    const operation: QueuedOperation = {
      id: `${type}_${trip.id}_${Date.now()}`,
      type,
      trip,
      attempts: 0,
    };
    queue.push(operation);
    await saveQueue(queue);
    console.log(`[Offline Queue] Added ${type} operation for trip ${trip.id}`);
  } catch (error) {
    console.error('[Offline Queue] Error adding to queue:', error);
  }
}

/**
 * Get queue status
 */
export async function getQueueStatus(): Promise<{
  total: number;
  pending: number;
  failed: number;
}> {
  const queue = await getQueue();
  const pending = queue.filter((op) => op.attempts < MAX_RETRY_ATTEMPTS).length;
  const failed = queue.filter((op) => op.attempts >= MAX_RETRY_ATTEMPTS).length;

  return {
    total: queue.length,
    pending,
    failed,
  };
}

/**
 * Clear all failed operations from queue
 */
export async function clearFailedOperations(): Promise<void> {
  const queue = await getQueue();
  const remaining = queue.filter((op) => op.attempts < MAX_RETRY_ATTEMPTS);
  await saveQueue(remaining);
  console.log('[Offline Queue] Cleared failed operations');
}
