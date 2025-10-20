// Conditional import to prevent crashes if module not available
let RNIap: any = null;

try {
  RNIap = require('react-native-iap');
  console.log('[Apple IAP] Module loaded successfully');
} catch (error) {
  console.warn('[Apple IAP] react-native-iap module not available:', error);
}

// Export types for compatibility
export type Product = any;
export type Purchase = any;
export type PurchaseError = any;

import { Platform } from 'react-native';
import { supabase } from './supabase';
import { getCurrentUser } from './authService';

// Define your product IDs - these MUST match what you create in App Store Connect
const PRODUCT_IDS = {
  trial: 'com.mileagetracker.trial',
  monthly: 'com.mileagetracker.monthly',
  annual: 'com.mileagetracker.annual',
};

const PRODUCT_IDS_LIST = Object.values(PRODUCT_IDS);

let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;

/**
 * Initialize Apple IAP connection
 * Call this on app startup
 */
export async function initializeIAP(): Promise<boolean> {
  if (!RNIap) {
    console.log('[Apple IAP] Module not available - skipping initialization');
    return false;
  }

  try {
    const result = await RNIap.initConnection();
    console.log('[Apple IAP] ✅ Connection initialized:', result);

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
  // Remove any existing listeners
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
  }

  // Listen for purchase updates
  purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase: any) => {
    console.log('[Apple IAP] Purchase updated:', purchase);

    const receipt = purchase.transactionId;
    if (receipt) {
      try {
        // Verify the purchase with Apple (or your backend)
        // For now, we'll just update Supabase and finish the transaction
        await updateSupabaseSubscription(purchase);

        // Finish the transaction
        await RNIap.finishTransaction({ purchase, isConsumable: false });
        console.log('[Apple IAP] ✅ Transaction finished');
      } catch (error) {
        console.error('[Apple IAP] Error handling purchase update:', error);
      }
    }
  });

  // Listen for purchase errors
  purchaseErrorSubscription = RNIap.purchaseErrorListener((error: any) => {
    console.error('[Apple IAP] Purchase error:', error);
  });
}

/**
 * Clean up IAP connection
 * Call this when app is closing
 */
export async function cleanupIAP(): Promise<void> {
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
    console.log('[Apple IAP] Connection closed');
  } catch (error) {
    console.error('[Apple IAP] Error closing connection:', error);
  }
}

/**
 * Get available subscription products
 */
export async function getSubscriptionProducts(): Promise<any[] | null> {
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
  try {
    // Get available purchases from Apple
    const purchases = await RNIap.getAvailablePurchases();

    if (!purchases || purchases.length === 0) {
      console.log('[Apple IAP] No purchases found');
      return false;
    }

    // Check if any purchase is one of our subscription products
    const hasActiveSubscription = purchases.some((purchase: any) =>
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
export async function getAllPurchases(): Promise<any[]> {
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
  try {
    const purchases = await RNIap.getAvailablePurchases();

    if (!purchases || purchases.length === 0) {
      return {
        success: false,
        error: new Error('No purchases found to restore'),
      };
    }

    console.log('[Apple IAP] Found purchases to restore:', purchases.length);

    // Update Supabase with restored purchases
    const subscriptionPurchase = purchases.find((purchase: any) =>
      PRODUCT_IDS_LIST.includes(purchase.productId)
    );

    if (subscriptionPurchase) {
      await updateSupabaseSubscription(subscriptionPurchase);
    }

    console.log('[Apple IAP] ✅ Purchases restored');
    return { success: true, error: null };
  } catch (error) {
    console.error('[Apple IAP] Error restoring purchases:', error);
    return { success: false, error: error as Error };
  }
}

/**
 * Update Supabase profile with subscription status from Apple
 */
async function updateSupabaseSubscription(purchase: any): Promise<void> {
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

    let subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled' = 'active';

    // For Apple subscriptions, we'd typically verify the receipt with Apple's servers
    // or use a backend service to validate. For now, we'll mark as active.
    // In production, you should verify the receipt with Apple's verifyReceipt API

    const subscriptionExpiresAt = 'transactionDate' in purchase && purchase.transactionDate
      ? new Date(purchase.transactionDate).toISOString()
      : null;

    // Update profile in Supabase
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_status: subscriptionStatus,
        subscription_expires_at: subscriptionExpiresAt,
        apple_transaction_id: purchase.transactionId,
      })
      .eq('id', user.id);

    if (error) {
      console.error('[Apple IAP] Error updating Supabase profile:', error);
    } else {
      console.log('[Apple IAP] ✅ Updated Supabase profile with subscription status');
    }
  } catch (error) {
    console.error('[Apple IAP] Error in updateSupabaseSubscription:', error);
  }
}

/**
 * Check if user should see paywall
 * Returns true if user doesn't have an active Apple subscription
 */
export async function shouldShowPaywall(): Promise<boolean> {
  try {
    // Check Apple for active subscription (including free trial)
    const hasActiveAppleSubscription = await hasActiveSubscription();
    if (hasActiveAppleSubscription) {
      console.log('[Apple IAP] User has active subscription, no paywall');
      return false; // Has subscription or active trial, don't show paywall
    }

    // Check Supabase profile for subscription status
    const user = await getCurrentUser();
    if (!user) {
      console.log('[Apple IAP] No user, show paywall');
      return true; // Not logged in, show paywall
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single();

    if (!profile) {
      console.log('[Apple IAP] No profile, show paywall');
      return true; // No profile, show paywall
    }

    // If has active or trial subscription in Supabase (synced from Apple)
    if (profile.subscription_status === 'active' || profile.subscription_status === 'trial') {
      console.log('[Apple IAP] Subscription status is active/trial, no paywall');
      return false;
    }

    console.log('[Apple IAP] No active subscription, showing paywall');
    return true; // No subscription, show paywall
  } catch (error) {
    console.error('[Apple IAP] Error checking if should show paywall:', error);
    return true; // On error, show paywall to be safe
  }
}

/**
 * Get subscription expiration date from Supabase
 * Note: For production, you should verify with Apple's servers
 */
export async function getSubscriptionExpirationDate(): Promise<Date | null> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_expires_at')
      .eq('id', user.id)
      .single();

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
