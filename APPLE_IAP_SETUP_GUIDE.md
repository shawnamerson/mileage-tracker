# Apple In-App Purchase Setup Guide

This guide will walk you through setting up Apple In-App Purchases (IAP) for MileMate subscriptions.

## Overview

MileMate now uses native Apple In-App Purchases instead of RevenueCat. This gives you direct control over subscriptions and eliminates the need for third-party services.

## Prerequisites

- Apple Developer Account ($99/year)
- App Store Connect access
- Xcode installed on your Mac
- EAS Build account (for building iOS apps)

## Step 1: Update Supabase Database

If you already have a database set up, run the migration to add the new Apple IAP column:

1. Go to your Supabase project dashboard
2. Click "SQL Editor" in the sidebar
3. Click "New query"
4. Copy and paste the contents of `supabase-apple-iap-migration.sql`
5. Click "Run"

If you're setting up a fresh database, use `supabase-schema.sql` which already includes the Apple IAP fields.

## Step 2: Create In-App Purchase Products in App Store Connect

1. **Sign in to App Store Connect**
   - Go to https://appstoreconnect.apple.com
   - Sign in with your Apple Developer account

2. **Navigate to your app**
   - Select "My Apps"
   - Select your app (or create a new one if needed)

3. **Create subscription group**
   - Go to the "Subscriptions" tab in the left sidebar
   - Click "+" to create a new subscription group
   - Name it something like "MileMate Premium"
   - Reference Name: "premium_subscriptions"

4. **Create Monthly Subscription**
   - Click "+" to add a subscription to the group
   - Product ID: `com.mileagetracker.monthly` (MUST match the ID in subscriptionService.ts)
   - Reference Name: "Monthly Subscription"
   - Subscription Duration: 1 Month
   - Set your pricing (e.g., $4.99/month)
   - Add localized subscription information:
     - Subscription Display Name: "Monthly Premium"
     - Description: "Access to all premium features with monthly billing"
   - Upload a subscription icon (optional but recommended)

5. **Create Annual Subscription**
   - Click "+" to add another subscription to the same group
   - Product ID: `com.mileagetracker.annual` (MUST match the ID in subscriptionService.ts)
   - Reference Name: "Annual Subscription"
   - Subscription Duration: 1 Year
   - Set your pricing (e.g., $39.99/year - represents a 33% savings)
   - Add localized subscription information:
     - Subscription Display Name: "Annual Premium"
     - Description: "Access to all premium features with annual billing - Save 33%"
   - Upload a subscription icon (optional but recommended)

6. **Review subscription settings**
   - Set up free trial if desired (e.g., 3 days, 7 days, or 1 month)
   - Configure introductory offers if needed
   - Set up subscription renewal information

## Step 3: Configure App Store Connect Settings

1. **Set up Paid Applications Agreement**
   - Go to "Agreements, Tax, and Banking"
   - Complete the Paid Applications Agreement
   - Add your banking information
   - Add tax information
   - Wait for Apple to approve your agreement

2. **Configure subscription settings**
   - In your app's Subscriptions section, review:
     - Subscription Group Display Name
     - Subscription renewal behavior
     - Billing retry settings

## Step 4: Update Product IDs in Code (if needed)

The product IDs in `services/subscriptionService.ts` are:
```typescript
const PRODUCT_IDS = {
  monthly: 'com.mileagetracker.monthly',
  annual: 'com.mileagetracker.annual',
};
```

**IMPORTANT:** These IDs MUST exactly match the Product IDs you created in App Store Connect. If you used different IDs, update them in the code.

## Step 5: Build and Test on TestFlight

1. **Build your app with EAS Build**
   ```bash
   eas build --platform ios --profile production
   ```

2. **Submit to TestFlight**
   ```bash
   eas submit --platform ios
   ```

3. **Test subscriptions in TestFlight**
   - Subscriptions work in TestFlight with sandbox accounts
   - Create a sandbox tester account in App Store Connect:
     - Go to "Users and Access" > "Sandbox" > "Testers"
     - Add a new sandbox tester with a unique email
   - Install your app from TestFlight
   - Sign out of your regular Apple ID in Settings > App Store
   - When prompted to sign in for a purchase, use your sandbox account
   - Test both monthly and annual subscriptions
   - Verify purchases are recorded in your Supabase database

## Step 6: Sandbox Testing

When testing in TestFlight or iOS Simulator:

1. **Important notes about sandbox testing:**
   - Sandbox subscriptions have accelerated timeframes:
     - 1 week subscription = 3 minutes in sandbox
     - 1 month subscription = 5 minutes in sandbox
     - 1 year subscription = 1 hour in sandbox
   - Subscriptions automatically renew up to 6 times in sandbox
   - You won't be charged real money
   - Use sandbox tester accounts created in App Store Connect

2. **Test scenarios to verify:**
   - [ ] Purchase monthly subscription
   - [ ] Purchase annual subscription
   - [ ] Restore purchases on the same device
   - [ ] Install app on a second device and restore purchases
   - [ ] Verify subscription status updates in Supabase
   - [ ] Verify paywall appears when trial expires
   - [ ] Verify app access after successful purchase
   - [ ] Test subscription cancellation (through Settings app)
   - [ ] Verify app behavior after subscription expires

## Step 7: Production Release

1. **Submit app for review**
   - Make sure subscriptions are properly configured
   - Add clear subscription terms and privacy policy
   - Include screenshots showing the subscription paywall
   - Explain to reviewers how to access premium features

2. **What to include in App Review Information:**
   - Demo account credentials if needed
   - Instructions on how to trigger the paywall
   - Explanation of what features require subscription

3. **Required metadata:**
   - Privacy Policy URL (add to app.json)
   - Terms of Service URL (add to app.json)
   - Subscription terms must be clearly displayed in-app

## Troubleshooting

### Products not loading

**Problem:** `getSubscriptionProducts()` returns null or empty array

**Solutions:**
1. Verify Product IDs in App Store Connect match exactly with code
2. Make sure products are in "Ready to Submit" or "Approved" state
3. Check that your app's Bundle ID matches App Store Connect
4. Wait a few hours after creating products (Apple servers can take time to propagate)
5. Verify Paid Applications Agreement is signed and approved
6. Try clearing app data and reinstalling

### Purchase fails with "Cannot connect to iTunes Store"

**Solutions:**
1. Make sure you're using a sandbox tester account in TestFlight
2. Sign out of regular Apple ID in Settings > App Store
3. Verify network connection
4. Check App Store Connect for any pending agreements
5. Make sure your app's Bundle ID is configured correctly

### Purchases not restoring

**Solutions:**
1. Verify you're signed in with the same Apple ID used for purchase
2. Check that `finishTransaction` is being called properly
3. Verify receipt validation is working
4. Check Supabase for transaction records

### App Review rejection for IAP

**Common reasons:**
1. Subscription terms not clearly displayed
2. Missing privacy policy or terms of service
3. Features available without purchase (should be locked)
4. Confusing subscription flow
5. Missing restore purchases button

## Important Product IDs Reference

Current product IDs configured in the app:
- Monthly: `com.mileagetracker.monthly`
- Annual: `com.mileagetracker.annual`

To change these:
1. Update `PRODUCT_IDS` in `services/subscriptionService.ts`
2. Create matching products in App Store Connect
3. Rebuild and resubmit your app

## Receipt Validation (Optional but Recommended)

For production apps, you should implement server-side receipt validation to prevent fraud:

1. When a purchase completes, send the receipt to your backend
2. Your backend validates the receipt with Apple's verifyReceipt API
3. Your backend updates Supabase with verified subscription status
4. This prevents users from manipulating local data

Example flow:
```
User purchases → App gets receipt → Send to your backend →
Backend validates with Apple → Backend updates Supabase →
App refreshes subscription status
```

## Additional Resources

- [Apple In-App Purchase Documentation](https://developer.apple.com/in-app-purchase/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [react-native-iap Documentation](https://github.com/dooboolab/react-native-iap)
- [Expo and In-App Purchases](https://docs.expo.dev/guides/in-app-purchases/)

## Support

If you run into issues:
1. Check the console logs for error messages (they start with `[Apple IAP]`)
2. Verify all steps in this guide were completed
3. Test with a fresh sandbox account
4. Check App Store Connect for any warnings or errors

## Next Steps

After setting up Apple IAP:
1. Test thoroughly in TestFlight
2. Set up analytics to track subscription metrics
3. Consider implementing promotional offers
4. Set up subscription management in your app
5. Add subscription status to user settings screen
