# Vehicle Mileage Race Condition Fix

## Problem

The original `updateVehicleMileage` function had a classic race condition:

```typescript
// OLD CODE - RACE CONDITION!
const vehicle = await getVehicle(vehicleId);        // 1. Read current value
const newMileage = vehicle.current_mileage + miles; // 2. Calculate new value
await updateVehicle(vehicleId, { current_mileage: newMileage }); // 3. Write new value
```

### What Could Go Wrong:

**Scenario:** Two trips complete at the same time

| Time | Trip A (10 miles)           | Trip B (5 miles)            | Database Mileage |
|------|-----------------------------|-----------------------------|------------------|
| T0   | -                           | -                           | 1000             |
| T1   | Read: 1000                  | Read: 1000                  | 1000             |
| T2   | Calculate: 1000 + 10 = 1010 | Calculate: 1000 + 5 = 1005  | 1000             |
| T3   | Write: 1010                 | -                           | 1010             |
| T4   | -                           | Write: 1005                 | **1005** ❌      |

**Result:** Final mileage is 1005 instead of 1015. **10 miles lost!**

---

## Solution

Created an atomic PostgreSQL function that increments the value directly in the database:

### Database Function (supabase/migrations/20251023_atomic_mileage_update.sql)

```sql
CREATE OR REPLACE FUNCTION increment_vehicle_mileage(
  vehicle_id_param uuid,
  miles_to_add numeric
)
RETURNS TABLE (...)
AS $$
BEGIN
  -- Atomic operation - no race condition possible
  UPDATE vehicles
  SET current_mileage = current_mileage + miles_to_add
  WHERE id = vehicle_id_param
  RETURNING *;
END;
$$;
```

### Updated Service Code (services/vehicleService.ts)

```typescript
// NEW CODE - ATOMIC!
const { data } = await supabase.rpc('increment_vehicle_mileage', {
  vehicle_id_param: vehicleId,
  miles_to_add: additionalMiles,
});
```

### How It Works Now:

**Scenario:** Same two trips at the same time

| Time | Trip A (10 miles)                  | Trip B (5 miles)                   | Database Mileage |
|------|------------------------------------|------------------------------------|------------------|
| T0   | -                                  | -                                  | 1000             |
| T1   | Call: increment(10)                | Call: increment(5)                 | 1000             |
| T2   | DB: UPDATE SET mileage += 10       | DB: Waits for lock...              | 1010             |
| T3   | Returns: { current_mileage: 1010 } | DB: UPDATE SET mileage += 5        | 1015             |
| T4   | ✅ Done                            | Returns: { current_mileage: 1015 } | **1015** ✅      |

**Result:** Final mileage is 1015. **Correct!**

---

## Technical Details

### Why This Works:

1. **Database-level atomicity**: PostgreSQL ensures the UPDATE operation is atomic
2. **Row-level locking**: The database automatically locks the row during the update
3. **Serialization**: If two updates happen simultaneously, they're executed one after another
4. **No read-then-write gap**: The value is never read into application memory

### Benefits:

- ✅ **Thread-safe**: Multiple trips can complete simultaneously
- ✅ **No data loss**: All mileage updates are counted
- ✅ **Better performance**: Single database round-trip instead of three
- ✅ **Simpler code**: Database handles the complexity

---

## Testing

### Manual Test:

1. Create a test vehicle with initial mileage 1000
2. Call `updateVehicleMileage` twice rapidly:
   ```typescript
   await Promise.all([
     updateVehicleMileage(vehicleId, 10),
     updateVehicleMileage(vehicleId, 5),
   ]);
   ```
3. Check the vehicle's current_mileage
4. Should be: 1015 ✅ (not 1005 or 1010)

### What Changed:

**Before:**
- Read → Calculate → Write (3 operations)
- Race condition possible
- Could lose updates

**After:**
- Atomic increment (1 operation)
- No race condition
- All updates guaranteed

---

## Migration Checklist

- [x] Created PostgreSQL function in database
- [x] Updated `vehicleService.ts` to use atomic function
- [x] Added user verification for security
- [ ] Test with concurrent trip completions

---

## Related Files

- `services/vehicleService.ts` - Updated service
- `supabase/migrations/20251023_atomic_mileage_update.sql` - Database function

---

## Additional Notes

This is a common pattern for preventing race conditions in concurrent systems. Other places in the codebase that might benefit from similar atomic operations:

- Trip statistics calculations (if they aggregate counts)
- Subscription seat counts (if multi-user)
- Any counter that increments based on user actions

The key principle: **Never read-then-write for values that should accumulate. Always use atomic operations.**
