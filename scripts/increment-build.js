#!/usr/bin/env node
/* eslint-env node */

const fs = require('fs');
const path = require('path');

// Get platform from command line args or environment variable
const args = process.argv.slice(2);
const platformArg = args.find(arg => arg.startsWith('--platform='));
const platform = platformArg
  ? platformArg.split('=')[1]
  : process.env.EAS_BUILD_PLATFORM || 'all';

// Path to app.json
// eslint-disable-next-line no-undef
const appJsonPath = path.join(__dirname, '..', 'app.json');

// Read app.json
let appJson;
try {
  const appJsonData = fs.readFileSync(appJsonPath, 'utf8');
  appJson = JSON.parse(appJsonData);
} catch (error) {
  console.error('❌ Failed to read app.json:', error.message);
  process.exit(1);
}

// Get current build numbers
const currentIosBuild = parseInt(appJson.expo.ios.buildNumber, 10);
const currentAndroidVersion = appJson.expo.android.versionCode;

console.log(`📦 Current build numbers - iOS: ${currentIosBuild}, Android: ${currentAndroidVersion}`);

// Increment based on platform
if (platform === 'ios' || platform === 'all') {
  const newIosBuild = currentIosBuild + 1;
  appJson.expo.ios.buildNumber = newIosBuild.toString();
  console.log(`   📱 iOS buildNumber: ${currentIosBuild} → ${newIosBuild}`);
}

if (platform === 'android' || platform === 'all') {
  const newAndroidVersion = currentAndroidVersion + 1;
  appJson.expo.android.versionCode = newAndroidVersion;
  console.log(`   🤖 Android versionCode: ${currentAndroidVersion} → ${newAndroidVersion}`);
}

// Write updated app.json
try {
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
  console.log(`\n✅ Updated app.json for platform: ${platform}`);
  console.log('💡 app.json has been modified - will be staged for git commit\n');
} catch (error) {
  console.error('❌ Failed to save app.json:', error.message);
  process.exit(1);
}
