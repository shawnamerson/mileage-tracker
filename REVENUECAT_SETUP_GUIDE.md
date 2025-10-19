# RevenueCat Setup Guide - MileMate Subscriptions

This guide walks you through setting up RevenueCat for in-app subscriptions.

---

## Part 1: Create RevenueCat Account (5 minutes)

### Step 1: Sign Up for RevenueCat

1. Go to https://app.revenuecat.com/signup
2. Sign up with your email or GitHub
3. **Free tier**: Up to $2,500 monthly tracked revenue (perfect to start!)

### Step 2: Create a New Project

1. After signing up, click **"Create New Project"**
2. **Project Name**: MileMate
3. Click **"Create"**

### Step 3: Get Your API Keys

1. In your RevenueCat dashboard, go to **Project Settings** (gear icon)
2. Click **"API Keys"** in the left sidebar
3. You'll see:
   - **Public SDK key** (starts with `appl_` for iOS or `goog_` for Android)
   - Copy the **iOS Public SDK Key** (we'll use this)

**Save this key** - you'll paste it into the code in a moment.

---

## Part 2: Configure App Store Connect (15-20 minutes)

⚠️ **Prerequisites:**
- Apple Developer Account ($99/year)
- App already created in App Store Connect
- Bundle ID: `com.trackmymileage.app`

### Step 1: Create Subscription Products

1. Go to https://appstoreconnect.apple.com
2. Click **"My Apps"** → Select your app (or create it)
3. Go to **"Subscriptions"** in the left sidebar
4. Click **"+" Create Subscription Group**
   - **Reference Name**: MileMate Premium
   - **Group Name**: MileMate Premium (visible to users)

### Step 2: Add Monthly Subscription

1. In the subscription group, click **"+"** to add a subscription
2. Fill in:
   - **Reference Name**: Monthly Premium
   - **Product ID**: `milemate_monthly_499` ⚠️ **Copy this exactly!**
   - **Subscription Duration**: 1 Month
   - **Price**: $4.99 USD

3. **Add Subscription Information:**
   - **Display Name**: Monthly Premium
   - **Description**: "Track unlimited trips with auto-tracking, exports, and cloud sync"

4. **Add Review Information** (for App Store approval):
   - Screenshot (can use a screenshot of your paywall)
   - Review notes explaining the subscription

### Step 3: Add Annual Subscription

1. Click **"+"** again to add another subscription
2. Fill in:
   - **Reference Name**: Annual Premium
   - **Product ID**: `milemate_annual_3999` ⚠️ **Copy this exactly!**
   - **Subscription Duration**: 1 Year
   - **Price**: $39.99 USD

3. **Add Subscription Information:**
   - **Display Name**: Annual Premium (Save 33%)
   - **Description**: "Track unlimited trips with auto-tracking, exports, and cloud sync. Best value!"

### Step 4: Set Up Free Trial

1. For **both subscriptions**, scroll down to **"Introductory Offer"**
2. Click **"Add Introductory Offer"**
3. Select:
   - **Type**: Free
   - **Duration**: 2 Weeks (14 days)
   - **Territories**: All

⚠️ **Important**: The trial in App Store Connect should match the trial in your Supabase database (both are 14 days).

### Step 5: Enable Subscriptions for Testing

1. Click **"Save"** on both subscriptions
2. Make sure they're set to **"Ready to Submit"** status
3. You can test immediately using **Sandbox accounts**

---

## Part 3: Connect App Store Connect to RevenueCat (5 minutes)

### Step 1: Get App Store Connect API Key

1. In App Store Connect, go to **"Users and Access"** → **"Integrations"** → **"App Store Connect API"**
2. Click **"+"** to generate a new key
   - **Name**: RevenueCat
   - **Access**: Admin or App Manager
   - **Download the .p8 file** (you only get one chance!)
   - **Save the Issuer ID and Key ID**

### Step 2: Add to RevenueCat

1. In RevenueCat dashboard, go to your project
2. Click **"App Settings"** → **"Apple App Store"**
3. Click **"Configure"**
4. Fill in:
   - **Bundle ID**: `com.trackmymileage.app`
   - **Shared Secret**: Get from App Store Connect (In-App Purchase section)
   - **App Store Connect API**: Upload the .p8 file and enter Issuer ID and Key ID

---

## Part 4: Configure Products in RevenueCat (5 minutes)

### Step 1: Create Entitlements

1. In RevenueCat dashboard, go to **"Entitlements"**
2. Click **"+ New"**
3. **Identifier**: `premium`
4. **Display Name**: Premium Features
5. Click **"Save"**

This represents what users get when they subscribe.

### Step 2: Add Products

1. Go to **"Products"** in RevenueCat
2. Click **"+ New"**
3. For Monthly:
   - **Identifier**: `milemate_monthly_499`
   - **App Store Product ID**: `milemate_monthly_499` (must match!)
   - **Type**: Subscription
   - **Entitlement**: premium
   - Click **"Save"**

4. Click **"+ New"** again for Annual:
   - **Identifier**: `milemate_annual_3999`
   - **App Store Product ID**: `milemate_annual_3999`
   - **Type**: Subscription
   - **Entitlement**: premium
   - Click **"Save"**

### Step 3: Create an Offering

1. Go to **"Offerings"** in RevenueCat
2. The **"default"** offering is already created
3. Click on it → **"+ Add Package"**
4. Create two packages:

   **Package 1 - Monthly:**
   - **Identifier**: `monthly`
   - **Product**: `milemate_monthly_499`
   - Click **"Add"**

   **Package 2 - Annual:**
   - **Identifier**: `annual`
   - **Product**: `milemate_annual_3999`
   - Click **"Add"**

5. Set **annual** as the **default** package (recommended badge)

---

## Part 5: Testing with Sandbox

### Create Sandbox Test Accounts

1. In App Store Connect, go to **"Users and Access"** → **"Sandbox Testers"**
2. Click **"+"** to add a new tester
3. Fill in:
   - **Email**: Use a unique email (e.g., test1@yourdomain.com)
   - **Password**: Create a password
   - **First/Last Name**: Test User
   - **Country**: United States

4. Repeat to create 2-3 test accounts

### Testing the Subscription

1. **Sign out** of your real Apple ID on your test device:
   - Settings → App Store → Sign Out (at the bottom)

2. **Run your app** on the device
3. When you try to subscribe, it will ask for an Apple ID
4. Enter your **Sandbox account** credentials
5. You can test:
   - Purchase flows
   - Trial activation
   - Subscription renewal
   - Cancellation

⚠️ **Sandbox subscriptions renew much faster than real ones:**
- 3 days subscription = 2 minutes in sandbox
- 1 week = 3 minutes
- 1 month = 5 minutes
- 1 year = 1 hour

---

## Summary Checklist

Before continuing to code, make sure you have:

- [ ] RevenueCat account created
- [ ] RevenueCat project created for MileMate
- [ ] RevenueCat iOS Public SDK Key copied
- [ ] App Store Connect subscriptions created:
  - [ ] `milemate_monthly_499` ($4.99/month)
  - [ ] `milemate_annual_3999` ($39.99/year)
  - [ ] Both have 14-day free trials
- [ ] RevenueCat products configured
- [ ] RevenueCat entitlement "premium" created
- [ ] RevenueCat offering "default" with monthly and annual packages
- [ ] Sandbox test accounts created

---

## What's Next

Once you've completed the above setup, I'll integrate RevenueCat into your app with:
- Subscription service
- Paywall UI
- Trial expiration checking
- Feature gating
- Restore purchases

**Let me know when you have your RevenueCat iOS Public SDK Key and we'll continue!**
