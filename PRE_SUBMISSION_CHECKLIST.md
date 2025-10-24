# Pre-Submission Checklist for App Store

## ⚠️ IMPORTANT: Test Before Production

You've made **critical security and data integrity changes** that MUST be tested with TestFlight before submitting to production.

---

## Changes Made (Need Testing)

### 1. Apple IAP Receipt Verification ⚠️ CRITICAL
- **What changed**: All purchases now verified server-side with Apple
- **Risk**: Could block legitimate purchases if configured incorrectly
- **Must test**:
  - Sandbox purchases work
  - Receipts are verified
  - Subscription status updates correctly
  - Error handling works

### 2. Sync Strategy Overhaul
- **What changed**: Conflict resolution, offline queue, retry logic
- **Risk**: Could cause sync issues if bugs exist
- **Must test**:
  - Offline sync with queue
  - Conflict resolution (edit same trip on 2 devices)
  - Failed sync retry logic
  - Parallel uploads work correctly

### 3. Vehicle Mileage Atomic Update
- **What changed**: Now uses database function instead of read-write
- **Risk**: Could fail if function not deployed correctly
- **Must test**:
  - Mileage updates correctly after trips
  - Multiple simultaneous trips don't cause errors
  - No data loss

---

## Pre-TestFlight Checklist

### Code Quality
- [x] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] ESLint passes (`npx eslint .` or `npm run lint`)
- [ ] No console.error or unhandled errors in critical paths
- [ ] All new features have error handling

### Database & Backend
- [x] Supabase Edge Function deployed (`verify-apple-receipt`)
- [x] Apple Shared Secret configured in Supabase
- [x] Database migrations applied (apple columns + atomic function)
- [ ] Test database function works (run test query)

### Environment Configuration
- [ ] Verify Supabase project URL in code
- [ ] Verify Supabase anon key in code
- [ ] Apple IAP product IDs match App Store Connect
- [ ] Build number incremented

### Build Configuration
- [ ] Update version number in app.json
- [ ] Update build number (iOS & Android)
- [ ] EAS build profile configured (production vs preview)
- [ ] Signing certificates valid

---

## TestFlight Testing Steps

### Build & Deploy to TestFlight

1. **Increment build number:**
   ```bash
   npm run build:increment
   ```

2. **Build for iOS (TestFlight):**
   ```bash
   npm run build:ios
   ```
   Or for production profile:
   ```bash
   npm run build:ios:prod
   ```

3. **Submit to TestFlight** (via EAS)

4. **Wait for Apple review** (usually 24-48 hours)

### Critical Test Cases

#### Test 1: Apple IAP Verification ⚠️ MOST IMPORTANT

**Setup:**
- Install TestFlight build
- Sign in with test account
- Have a sandbox Apple ID ready

**Steps:**
1. Navigate to subscription/paywall screen
2. Attempt to purchase a subscription (sandbox)
3. Complete the purchase flow
4. Check if subscription status updates

**Expected:**
- Purchase completes successfully
- No errors shown to user
- Subscription status shows "active" or "trial"
- User gains access to premium features

**Verify in Supabase:**
1. Go to Database → profiles table
2. Find your test user
3. Check these columns updated:
   - `subscription_status` = 'active' or 'trial'
   - `subscription_expires_at` = future date
   - `apple_transaction_id` = transaction ID
   - `apple_product_id` = product ID
   - `apple_environment` = 'Sandbox'

**Check Edge Function Logs:**
1. Supabase Dashboard → Edge Functions → verify-apple-receipt → Logs
2. Look for: `[Apple Verify] Receipt verified successfully`
3. Should NOT see: verification failed errors

**If it fails:**
- Check Apple Shared Secret is correct
- Verify product IDs match App Store Connect
- Check Edge Function logs for errors

---

#### Test 2: Offline Sync & Queue

**Steps:**
1. Enable airplane mode
2. Create 2-3 trips
3. Disable airplane mode
4. Wait 30 seconds

**Expected:**
- Trips sync automatically
- No error messages
- All trips appear in cloud (check another device or web)

**Verify in logs:**
- Look for: `[Sync Queue] Processed operation`
- Should see: number of queued trips processed

---

#### Test 3: Conflict Resolution

**Setup:**
- Install on two devices (or use web + app)

**Steps:**
1. Create a trip on Device A
2. Wait for sync
3. Edit the same trip on BOTH devices (different changes)
4. Save on Device A first
5. Save on Device B second
6. Wait for sync

**Expected:**
- No errors
- The most recently saved version wins
- Both devices show the same final data

---

#### Test 4: Vehicle Mileage Accuracy

**Steps:**
1. Note current vehicle mileage
2. Create a trip with 10 miles
3. Complete the trip
4. Check vehicle mileage increased by 10
5. Create another trip with 5 miles simultaneously
6. Complete both trips
7. Verify mileage = original + 15 (not 10 or 5)

**Expected:**
- Mileage always increases by exact trip distance
- No "lost" miles even with simultaneous trips

---

#### Test 5: Restore Purchases

**Steps:**
1. Make a purchase (sandbox)
2. Delete the app
3. Reinstall from TestFlight
4. Sign in with same account
5. Tap "Restore Purchases"

**Expected:**
- Subscription restored successfully
- User regains access
- No errors

---

### Monitor During Testing

**Supabase Dashboard:**
- Edge Functions → verify-apple-receipt → Logs
- Database → profiles (check subscription updates)
- Database → trips (check sync working)

**Look for:**
- ✅ `[Apple Verify] Receipt verified successfully`
- ✅ `[Sync] ✅ Sync complete`
- ✅ `[Sync Queue] Processing complete`
- ❌ Any error messages

---

## Known Issues to Watch For

### Apple IAP Issues

**Symptom:** "Receipt verification failed"
**Cause:** Incorrect shared secret or product ID
**Fix:** Verify APPLE_SHARED_SECRET in Supabase secrets

**Symptom:** Purchase completes but status doesn't update
**Cause:** Edge Function not deployed or JWT issue
**Fix:** Redeploy function, check logs

### Sync Issues

**Symptom:** Trips not syncing
**Cause:** Network error or queue full
**Fix:** Check queue status, look for error categorization

**Symptom:** Duplicate trips
**Cause:** Conflict resolution issue
**Fix:** Check timestamps, verify updated_at logic

### Vehicle Mileage Issues

**Symptom:** Mileage not updating
**Cause:** Database function not deployed
**Fix:** Run migration again in SQL Editor

---

## Production Checklist (After TestFlight)

Only proceed to production after ALL TestFlight tests pass:

- [ ] Apple IAP purchases work correctly
- [ ] Subscription status updates in database
- [ ] Edge Function logs show successful verifications
- [ ] Offline sync works with queue
- [ ] Conflict resolution tested on multiple devices
- [ ] Vehicle mileage updates correctly
- [ ] Restore purchases works
- [ ] No critical errors in logs
- [ ] At least 5 test users tested successfully

### Production Build Steps

1. **Ensure using production Apple environment:**
   - Product IDs are live in App Store Connect
   - Products in "Ready to Submit" status
   - App approved for IAP

2. **Build for production:**
   ```bash
   npm run build:ios:prod
   ```

3. **Submit to App Store:**
   - Via App Store Connect
   - Include detailed release notes
   - Mention IAP improvements (security)

4. **Monitor first 24 hours:**
   - Edge Function logs
   - Error rates
   - Subscription success rate
   - User feedback

---

## Rollback Plan (If Issues Found)

If critical issues are discovered in TestFlight:

### IAP Issues
1. Check APPLE_SHARED_SECRET is correct
2. Verify product IDs match
3. Check Edge Function logs
4. Test with different sandbox accounts

### Sync Issues
1. Check Supabase database connectivity
2. Review sync queue in AsyncStorage
3. Test offline scenarios
4. Verify conflict resolution logic

### Database Issues
1. Verify migrations applied correctly
2. Test atomic function manually:
   ```sql
   SELECT * FROM increment_vehicle_mileage('vehicle-id-here', 10);
   ```
3. Check row-level security policies

---

## Support Resources

**Supabase Dashboard:**
- Project: https://supabase.com/dashboard/project/zfpokorgpfklkzsgbbro

**Documentation:**
- `CODE_IMPROVEMENTS.md` - What changed
- `SUPABASE_SETUP_GUIDE.md` - Setup reference
- `RACE_CONDITION_FIX.md` - Vehicle mileage fix

**Get Help:**
- Supabase Discord: https://discord.supabase.com
- Expo Discord: https://chat.expo.dev

---

## Summary

### ✅ Ready for TestFlight:
- Code compiles
- Database configured
- Edge Function deployed
- All migrations applied

### ❌ NOT Ready for Production:
- **Must test all IAP flows in sandbox**
- **Must test sync on multiple devices**
- **Must verify mileage tracking works**
- **Must monitor logs during testing**

**Estimated testing time:** 2-3 hours minimum

**Recommendation:**
1. Build and submit to TestFlight
2. Test thoroughly for 2-3 days
3. Have 3-5 beta testers validate
4. Monitor Edge Function logs
5. Only then submit to production

---

Good luck! 🚀
