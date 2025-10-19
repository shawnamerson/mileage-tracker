# TestFlight Deployment Guide

Your Mileage Tracker app is now configured for TestFlight deployment with Bluetooth auto-tracking! Follow these steps to build and submit your app.

## Important: Development Client Required

This app now uses **expo-dev-client** and **react-native-ble-plx** for Bluetooth functionality. This means:

- You **cannot** use Expo Go for development
- You must build a development client or production build
- The app includes native Bluetooth modules

## Prerequisites

Before you begin, make sure you have:

1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com
   - Enroll in Apple Developer Program

2. **App Store Connect Setup**
   - Go to: https://appstoreconnect.apple.com
   - Create a new app
   - Note down your App ID

## Step 1: Configure Your Credentials

### Update app.json

The app.json has placeholder values that need to be updated:

```json
"extra": {
  "eas": {
    "projectId": "YOUR_PROJECT_ID_HERE"  // Will be auto-generated in step 2
  }
}
```

### Update eas.json

Update the submit section in `eas.json` with your details:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your.email@example.com",        // Your Apple ID email
      "ascAppId": "1234567890",                   // From App Store Connect
      "appleTeamId": "ABCD123456"                 // Your Team ID
    }
  }
}
```

**To find your Team ID:**
- Go to https://developer.apple.com/account
- Click on "Membership" in the sidebar
- Your Team ID is listed there

**To find your App Store Connect App ID:**
- Go to https://appstoreconnect.apple.com
- Select your app
- Go to "App Information"
- Look for "Apple ID" under "General Information"

## Step 2: Initialize EAS Project

Run the following command and log in with your Expo account:

```bash
eas init
```

This will:
- Create an Expo account if you don't have one
- Link your project to EAS
- Generate a project ID (automatically updates app.json)

## Step 3: Configure iOS Build

Log in to EAS:

```bash
eas login
```

Configure your iOS credentials:

```bash
eas credentials
```

Select:
- Platform: iOS
- Set up a new Apple App Identifier
- Generate a new Distribution Certificate
- Generate a new Provisioning Profile

**OR** if you prefer to use your own certificates:
- Select "Use existing credentials"
- Provide your certificate and provisioning profile

## Step 4: Build for Development (Recommended First)

Before building for TestFlight, test the Bluetooth feature with a development build:

```bash
eas build --platform ios --profile development
```

Install the development build on your device:
1. Download the build from the EAS dashboard
2. Install via TestFlight or directly on your device
3. Test Bluetooth pairing with your car

## Step 5: Build for TestFlight

Once you've tested the development build, build the production iOS app:

```bash
eas build --platform ios --profile production
```

This will:
- Upload your code to EAS servers
- Build the app on EAS Build servers with native Bluetooth support
- Generate an IPA file
- Provide a URL to download the build

**Build time:** Approximately 15-30 minutes

## Step 6: Submit to TestFlight

Once the build is complete, submit to TestFlight:

```bash
eas submit --platform ios --latest
```

You'll be prompted to:
- Log in to your Apple ID
- Provide your app-specific password (if using 2FA)

**To create an app-specific password:**
1. Go to https://appleid.apple.com
2. Sign in
3. Go to "Security" → "App-Specific Passwords"
4. Generate a new password

## Step 7: Configure TestFlight

After successful submission:

1. Go to https://appstoreconnect.apple.com
2. Select your app
3. Go to "TestFlight" tab
4. Add testers:
   - **Internal Testing**: Add up to 100 Apple Developer team members
   - **External Testing**: Add up to 10,000 testers (requires Apple review)

5. Distribute the build to testers
6. Testers will receive an email invitation

## Alternative: Local Build (Advanced)

If you prefer to build locally and upload manually:

```bash
# Build locally (requires Xcode on macOS)
eas build --platform ios --profile production --local

# Upload to App Store Connect manually using Xcode or Transporter app
```

## Troubleshooting

### "Bundle Identifier already exists"

If `com.mileagetracker.app` is taken, update it in `app.json`:

```json
"ios": {
  "bundleIdentifier": "com.yourcompany.mileagetracker"
}
```

### "Provisioning Profile Doesn't Include Signing Certificate"

Run:
```bash
eas credentials
```
And regenerate your provisioning profile.

### Build Fails

Check the build logs:
```bash
eas build:list
```

Select your build and view logs for detailed error messages.

## Updating Your App

To release a new version:

1. Update version in `app.json`:
   ```json
   "version": "1.0.1",
   "ios": {
     "buildNumber": "2"
   }
   ```

2. Build and submit:
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios --latest
   ```

## Bluetooth Auto-Tracking Features

Your app now includes two auto-tracking modes:

### Speed-Based Mode (Default)
- Automatically starts tracking when speed exceeds 5 mph
- Stops after 3 minutes stationary
- Works without any device pairing

### Bluetooth Trigger Mode (New!)
- Only tracks when connected to paired car Bluetooth
- Better battery efficiency
- More accurate (won't track when you're a passenger)
- Requires pairing your car's Bluetooth device

### Testing Bluetooth Features

1. Open the app and go to Settings
2. Enable "Automatic Tracking"
3. Select "Bluetooth Trigger" mode
4. Tap "Scan for Bluetooth Devices"
5. Pair your car's Bluetooth
6. Connect to your car and start driving

**Important Permissions:**
- Location: Always Allow (for background tracking)
- Bluetooth: Allow (for car detection)

## Additional Resources

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **EAS Submit Docs**: https://docs.expo.dev/submit/introduction/
- **TestFlight Guide**: https://developer.apple.com/testflight/
- **App Store Connect**: https://appstoreconnect.apple.com
- **Expo Dev Client**: https://docs.expo.dev/development/introduction/

## Next Steps

1. Complete the prerequisites above
2. Update credentials in `app.json` and `eas.json`
3. Run `eas init` to set up your project
4. Run `eas build --platform ios --profile production`
5. Run `eas submit --platform ios --latest`
6. Add testers in App Store Connect

Good luck with your TestFlight release!
