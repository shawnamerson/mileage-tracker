import { getCurrentUser, getUserProfile, activateSubscription as activateLocalSubscription } from './authService';

// Type definitions for react-native-iap
export interface Product {
  productId: string;
  price: string;
  currency: string;
  localizedPrice: string;
  title: string;
  description: string;
  subscriptionPeriodNumberIOS?: string;
  subscriptionPeriodUnitIOS?: string;
  introductoryPrice?: string;
}

export interface Purchase {
  productId: string;
  transactionId: string;
  transactionDate: number;
  transactionReceipt: string;
  purchaseToken?: string;
  dataAndroid?: string;
  signatureAndroid?: string;
  autoRenewingAndroid?: boolean;
  originalTransactionIdentifierIOS?: string;
}

export interface PurchaseError {
  code: string;
  message: string;
  responseCode?: number;
}

interface RNIapModule {
  initConnection: () => Promise<boolean>;
  endConnection: () => Promise<void>;
  getProducts: (skus: string[]) => Promise<Product[]>;
  getSubscriptions: (skus: string[]) => Promise<Product[]>;
  requestPurchase: (sku: string) => Promise<void>;
  getAvailablePurchases: () => Promise<Purchase[]>;
  finishTransaction: (options: { purchase: Purchase; isConsumable: boolean }) => Promise<void>;
  purchaseUpdatedListener: (listener: (purchase: Purchase) => void) => { remove: () => void };
  purchaseErrorListener: (listener: (error: PurchaseError) => void) => { remove: () => void };
}

// Conditional import to prevent crashes if module not available
let RNIap: RNIapModule | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RNIap = require('react-native-iap');
  console.log('[Apple IAP] Module loaded successfully');
} catch (error) {
  console.warn('[Apple IAP] react-native-iap module not available:', error);
}

// Define your product IDs - these MUST match what you create in App Store Connect
const PRODUCT_IDS = {
  trial: 'com.mileagetracker.trial',
  monthly: 'com.mileagetracker.monthly',
  annual: 'com.mileagetracker.annual',
};

const PRODUCT_IDS_LIST = Object.values(PRODUCT_IDS);

let purchaseUpdateSubscription: { remove: () => void } | null = null;
let purchaseErrorSubscription: { remove: () => void } | null = null;
let isIAPInitialized = false;

/**
 * Initialize Apple IAP connection
 * Call this on app startup
 * Safe to call multiple times - will only initialize once
 */
export async function initializeIAP(): Promise<boolean> {
  if (!RNIap) {
    console.log('[Apple IAP] Module not available - skipping initialization');
    return false;
  }

  // Prevent duplicate initialization
  if (isIAPInitialized) {
    console.log('[Apple IAP] Already initialized, skipping');
    return true;
  }

  try {
    const result = await RNIap.initConnection();
    console.log('[Apple IAP] ✅ Connection initialized:', result);
    isIAPInitialized = true;

    // Set up listeners for purchase updates
    setupPurchaseListeners();

    return true;
  } catch (error: any) {
    console.error('[Apple IAP] Error initializing connection:', error);
    // Don't crash - IAP might not be available in all environments
    console.log('[Apple IAP] Continuing without IAP - this is normal in development');
    return false;
  }
}

/**
 * Set up listeners for purchase updates
 */
function setupPurchaseListeners() {
  if (!RNIap) {
    console.error('[Apple IAP] Cannot setup listeners - RNIap not available');
    return;
  }

  // Remove any existing listeners
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
  }

  // Listen for purchase updates
  purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase: Purchase) => {
    console.log('[Apple IAP] Purchase updated:', purchase);

    const receipt = purchase.transactionId;
    if (receipt) {
      try {
        // Update local subscription status
        await updateLocalSubscription(purchase);

        // Finish the transaction
        await RNIap.finishTransaction({ purchase, isConsumable: false });
        console.log('[Apple IAP] ✅ Transaction finished and subscription activated');
      } catch (error) {
        console.error('[Apple IAP] ❌ Error handling purchase update:', error);
        console.error('[Apple IAP] Transaction NOT finished - activation failed');
      }
    }
  });

  // Listen for purchase errors
  purchaseErrorSubscription = RNIap.purchaseErrorListener((error: PurchaseError) => {
    console.error('[Apple IAP] Purchase error:', error);
  });
}

/**
 * Clean up IAP connection
 * Call this when app is closing
 * Note: Usually not necessary unless truly shutting down the app
 */
export async function cleanupIAP(): Promise<void> {
  if (!RNIap) {
    console.log('[Apple IAP] Module not available - skipping cleanup');
    return;
  }

  if (!isIAPInitialized) {
    console.log('[Apple IAP] Not initialized, skipping cleanup');
    return;
  }

  try {
    if (purchaseUpdateSubscription) {
      purchaseUpdateSubscription.remove();
      purchaseUpdateSubscription = null;
    }
    if (purchaseErrorSubscription) {
      purchaseErrorSubscription.remove();
      purchaseErrorSubscription = null;
    }
    await RNIap.endConnection();
    isIAPInitialized = false;
    console.log('[Apple IAP] Connection closed');
  } catch (error) {
    console.error('[Apple IAP] Error closing connection:', error);
  }
}

/**
 * Get available subscription products
 */
export async function getSubscriptionProducts(): Promise<Product[] | null> {
  if (!RNIap) {
    console.log('[Apple IAP] Module not available');
    return null;
  }

  try {
    // For iOS subscriptions, use getProducts
    // @ts-ignore - using correct API for react-native-iap
    const products = await (RNIap.getProducts || RNIap.getSubscriptions)(PRODUCT_IDS_LIST);

    if (products && products.length > 0) {
      console.log('[Apple IAP] Available products:', products.length);
      return products;
    }

    console.log('[Apple IAP] No products available - this is normal if:');
    console.log('  - Products not yet created in App Store Connect');
    console.log('  - Products not in "Ready to Submit" status');
    console.log('  - Testing in simulator (IAP not supported)');
    console.log('  - App not yet approved/published');
    return null;
  } catch (error: any) {
    console.error('[Apple IAP] Error getting products:', error);
    console.log('[Apple IAP] This is expected in development/simulator');
    return null;
  }
}

/**
 * Purchase a subscription
 */
export async function purchaseSubscription(
  productId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    // @ts-ignore - using correct API for react-native-iap
    await RNIap.requestPurchase(productId);

    // Note: The actual purchase result will be handled by the purchaseUpdatedListener
    // This just initiates the purchase flow
    console.log('[Apple IAP] Purchase initiated for:', productId);

    return { success: true, error: null };
  } catch (error: any) {
    console.error('[Apple IAP] Purchase error:', error);

    // Check if user cancelled
    if (error.code === 'E_USER_CANCELLED') {
      console.log('[Apple IAP] User cancelled purchase');
      return { success: false, error: new Error('Purchase cancelled') };
    }

    return { success: false, error: error as Error };
  }
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(): Promise<boolean> {
  if (!RNIap) {
    console.log('[Apple IAP] Module not available');
    return false;
  }

  try {
    // Get available purchases from Apple
    const purchases = await RNIap.getAvailablePurchases();

    if (!purchases || purchases.length === 0) {
      console.log('[Apple IAP] No purchases found');
      return false;
    }

    // Check if any purchase is one of our subscription products
    const hasActiveSubscription = purchases.some((purchase: Purchase) =>
      PRODUCT_IDS_LIST.includes(purchase.productId)
    );

    console.log('[Apple IAP] Has active subscription:', hasActiveSubscription);
    return hasActiveSubscription;
  } catch (error: any) {
    console.error('[Apple IAP] Error checking subscription:', error);
    console.log('[Apple IAP] Defaulting to no subscription - checking Supabase instead');
    return false;
  }
}

/**
 * Get all purchases (for debugging/verification)
 */
export async function getAllPurchases(): Promise<Purchase[]> {
  if (!RNIap) {
    console.log('[Apple IAP] Module not available');
    return [];
  }

  try {
    const purchases = await RNIap.getAvailablePurchases();
    return purchases || [];
  } catch (error) {
    console.error('[Apple IAP] Error getting purchases:', error);
    return [];
  }
}

/**
 * Restore purchases (for users who reinstalled app or switched devices)
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  error: Error | null;
}> {
  if (!RNIap) {
    console.log('[Apple IAP] Module not available');
    return {
      success: false,
      error: new Error('IAP module not available'),
    };
  }

  try {
    const purchases = await RNIap.getAvailablePurchases();

    if (!purchases || purchases.length === 0) {
      return {
        success: false,
        error: new Error('No purchases found to restore'),
      };
    }

    console.log('[Apple IAP] Found purchases to restore:', purchases.length);

    // Update local profile with restored purchases
    const subscriptionPurchase = purchases.find((purchase: Purchase) =>
      PRODUCT_IDS_LIST.includes(purchase.productId)
    );

    if (subscriptionPurchase) {
      await updateLocalSubscription(subscriptionPurchase);
    }

    // Clear paywall cache so UI updates immediately
    clearPaywallCache();

    console.log('[Apple IAP] ✅ Purchases restored');
    return { success: true, error: null };
  } catch (error) {
    console.error('[Apple IAP] Error restoring purchases:', error);
    return { success: false, error: error as Error };
  }
}

/**
 * Update local subscription status from Apple IAP purchase
 * (Offline-first version - no server verification)
 */
async function updateLocalSubscription(purchase: Purchase): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('[Apple IAP] No user logged in');
      return;
    }

    // Determine subscription type based on product ID
    const isSubscription = PRODUCT_IDS_LIST.includes(purchase.productId);

    if (!isSubscription) {
      console.log('[Apple IAP] Purchase is not a subscription');
      return;
    }

    console.log('[Apple IAP] Activating subscription for product:', purchase.productId);

    // Calculate expiration date based on product type
    let expiresAt: string | null = null;

    if (purchase.productId === PRODUCT_IDS.monthly) {
      // Monthly subscription - expires in 30 days
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      expiresAt = expires.toISOString();
    } else if (purchase.productId === PRODUCT_IDS.annual) {
      // Annual subscription - expires in 365 days
      const expires = new Date();
      expires.setDate(expires.getDate() + 365);
      expiresAt = expires.toISOString();
    }

    // Update local profile
    await activateLocalSubscription(user.id, expiresAt);

    console.log('[Apple IAP] ✅ Local subscription activated');

    // Clear paywall cache so UI updates immediately
    clearPaywallCache();
  } catch (error) {
    console.error('[Apple IAP] Error in updateLocalSubscription:', error);
    throw error; // Re-throw to be handled by caller
  }
}

// Cache for paywall check to avoid repeated slow checks
let paywallCache: { result: boolean; timestamp: number } | null = null;
const PAYWALL_CACHE_DURATION = 30000; // 30 seconds

/**
 * Check if user should see paywall
 * Returns true if user doesn't have an active Apple subscription
 *
 * OPTIMIZED: Checks database first (fast), then IAP (slow)
 * Caches result for 30 seconds to prevent blocking navigation
 */
export async function shouldShowPaywall(): Promise<boolean> {
  try {
    // Check cache first to avoid repeated checks during navigation
    if (paywallCache && Date.now() - paywallCache.timestamp < PAYWALL_CACHE_DURATION) {
      console.log('[Apple IAP] Using cached paywall result:', paywallCache.result);
      return paywallCache.result;
    }

    // Check local profile first (fast)
    const user = await getCurrentUser();
    if (!user) {
      console.log('[Apple IAP] No user, show paywall');
      const result = true;
      paywallCache = { result, timestamp: Date.now() };
      return result;
    }

    const profile = await getUserProfile(user.id);
    if (!profile) {
      console.log('[Apple IAP] No profile, show paywall');
      const result = true;
      paywallCache = { result, timestamp: Date.now() };
      return result;
    }

    // If has active or trial subscription in local profile
    if (profile.subscription_status === 'active' || profile.subscription_status === 'trial') {
      // Double-check expiration date if available
      if (profile.subscription_expires_at) {
        const expiresAt = new Date(profile.subscription_expires_at);
        if (expiresAt > new Date()) {
          console.log('[Apple IAP] Subscription is active and not expired, no paywall');
          const result = false;
          paywallCache = { result, timestamp: Date.now() };
          return result;
        } else {
          console.log('[Apple IAP] Subscription expired, checking Apple IAP...');
        }
      } else {
        console.log('[Apple IAP] Subscription active in profile, no paywall');
        const result = false;
        paywallCache = { result, timestamp: Date.now() };
        return result;
      }
    }

    // If local profile says no subscription, double-check with Apple IAP
    // This handles cases where the user restored purchases but profile isn't updated yet
    if (RNIap) {
      console.log('[Apple IAP] Checking Apple for active subscription...');
      const hasActiveAppleSubscription = await hasActiveSubscription();
      if (hasActiveAppleSubscription) {
        console.log('[Apple IAP] User has active Apple subscription, no paywall');
        const result = false;
        paywallCache = { result, timestamp: Date.now() };
        return result;
      }
    }

    console.log('[Apple IAP] No active subscription, showing paywall');
    const result = true;
    paywallCache = { result, timestamp: Date.now() };
    return result;
  } catch (error) {
    console.error('[Apple IAP] Error checking if should show paywall:', error);
    // On error, don't cache and show paywall to be safe
    return true;
  }
}

/**
 * Clear the paywall cache (call after purchase or restore)
 */
export function clearPaywallCache(): void {
  paywallCache = null;
  console.log('[Apple IAP] Paywall cache cleared');
}

/**
 * Get subscription expiration date from local profile
 * Note: For production, you should verify with Apple's servers
 */
export async function getSubscriptionExpirationDate(): Promise<Date | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    const profile = await getUserProfile(user.id);
    if (!profile || !profile.subscription_expires_at) {
      return null;
    }

    return new Date(profile.subscription_expires_at);
  } catch (error) {
    console.error('[Apple IAP] Error getting expiration date:', error);
    return null;
  }
}

// Export product IDs for use in other components
export { PRODUCT_IDS };
