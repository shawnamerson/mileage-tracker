# Queue Diagnostic Check

If a trip didn't save, here's how to check what happened:

## Check 1: Queue Status

Add this temporarily to your Settings screen to see queue status:

```typescript
import { getQueueStatus } from '@/services/syncService';

// In your component
const [queueStatus, setQueueStatus] = useState({ total: 0, pending: 0, failed: 0 });

useEffect(() => {
  const checkQueue = async () => {
    const status = await getQueueStatus();
    setQueueStatus(status);
    console.log('Queue Status:', status);
  };
  checkQueue();
}, []);

// In your render
{queueStatus.pending > 0 && (
  <ThemedText>⏱️ {queueStatus.pending} trips waiting to sync</ThemedText>
)}
{queueStatus.failed > 0 && (
  <ThemedText>❌ {queueStatus.failed} trips failed to sync</ThemedText>
)}
```

## Check 2: Active Trip Status

Open the Track Trip tab and check:
- Do you see "Unsaved Trip Found" alert?
- If yes → Trip is in recovery (can save manually)
- If no → Trip might be queued or lost

## Check 3: Console Logs

Look for these log messages:

**Trip Completed:**
```
[AutoTracking] Trip completed - Distance: 3.00 miles
[AutoTracking] Trip meets minimum distance, saving...
```

**Save Successful:**
```
[AutoTracking] ✅ Trip saved successfully with ID: xxx
```

**Save Queued:**
```
[AutoTracking] ⏱️ Trip queued for upload when connection available
[AutoTracking] ✅ Active trip cleared - trip will sync automatically
```

**Save Failed:**
```
[AutoTracking] ❌ Failed to save trip: [error message]
```

## What Each Means

### If you see "Trip saved successfully"
- ✅ Trip saved to cloud
- Check History tab - should be there
- If not there, might be a display issue

### If you see "Trip queued for upload"
- ✅ Trip queued (will sync when online)
- ✅ Active trip cleared (our fix working!)
- Wait ~5 seconds online
- Check History tab

### If you see "Failed to save trip"
- ⚠️ Real error occurred
- Trip kept in AsyncStorage
- Should see "Unsaved Trip Found" alert
- Can recover manually

### If you see nothing
- ❌ Might be an issue with auto-tracking task
- Check if auto-tracking is enabled
- Check location permissions

## Quick Fix Commands

**Manually process queue:**
```typescript
import { processQueue } from '@/services/syncService';

await processQueue();
```

**Check active trip:**
```typescript
import { getActiveTrip } from '@/services/backgroundTracking';

const trip = await getActiveTrip();
console.log('Active trip:', trip);
```
