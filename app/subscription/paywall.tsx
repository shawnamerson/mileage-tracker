import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColors, useShadows, Spacing, BorderRadius } from '@/constants/Design';
import {
  getSubscriptionProducts,
  purchaseSubscription,
  restorePurchases,
  PRODUCT_IDS,
  Product,
} from '@/services/subscriptionService';
import { useAuth } from '@/contexts/AuthContext';

export default function PaywallScreen() {
  const colors = useColors();
  const shadows = useShadows();
  const { refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [trialProduct, setTrialProduct] = useState<Product | null>(null);
  const [monthlyProduct, setMonthlyProduct] = useState<Product | null>(null);
  const [annualProduct, setAnnualProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<'trial' | 'monthly' | 'annual'>('trial');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const products = await getSubscriptionProducts();

      if (!products || products.length === 0) {
        console.log('[Paywall] No products available - user can still use trial');
        // Don't show error - products might not be available yet
        // User still has trial access
        setLoading(false);
        return;
      }

      // Find trial, monthly and annual products
      // Use 'productId' for iOS subscriptions
      const trial = products.find((product) => ('productId' in product && product.productId === PRODUCT_IDS.trial));
      const monthly = products.find((product) => ('productId' in product && product.productId === PRODUCT_IDS.monthly));
      const annual = products.find((product) => ('productId' in product && product.productId === PRODUCT_IDS.annual));

      setTrialProduct(trial || null);
      setMonthlyProduct(monthly || null);
      setAnnualProduct(annual || null);
    } catch (error) {
      console.error('Error loading products:', error);
      // Don't crash - just log the error
      console.log('[Paywall] Continuing without products - user still has trial');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    const product =
      selectedProduct === 'trial' ? trialProduct :
      selectedProduct === 'monthly' ? monthlyProduct :
      annualProduct;

    if (!product) {
      Alert.alert('Error', 'No product selected');
      return;
    }

    setPurchasing(true);
    try {
      const productId = ('productId' in product ? product.productId : '') as string;
      const { success, error } = await purchaseSubscription(productId);

      if (error) {
        if (error.message !== 'Purchase cancelled') {
          Alert.alert('Purchase Failed', error.message);
        }
        return;
      }

      if (success) {
        // Refresh profile to update subscription status
        await refreshProfile();

        Alert.alert(
          'Success!',
          'Your subscription is now active. Enjoy unlimited access to all premium features!',
          [
            {
              text: 'Continue',
              onPress: () => router.replace('/(tabs)'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const { success, error } = await restorePurchases();

      if (error) {
        Alert.alert('Restore Failed', error.message);
        return;
      }

      if (success) {
        await refreshProfile();
        Alert.alert('Success', 'Your purchases have been restored!', [
          {
            text: 'Continue',
            onPress: () => router.replace('/(tabs)'),
          },
        ]);
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }


  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/wordmark.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <ThemedText type="title" style={styles.title}>
          Choose Your Plan
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          Start with a 30-day free trial
        </ThemedText>
      </View>

      {/* Features */}
      <View style={[styles.featuresContainer, { backgroundColor: colors.surface }, shadows.md]}>
        <ThemedText type="subtitle" style={styles.featuresTitle}>
          Premium Features
        </ThemedText>

        <View style={styles.featuresList}>
          <FeatureItem icon="✓" text="Unlimited trip tracking" colors={colors} />
          <FeatureItem icon="✓" text="Automatic GPS-based tracking" colors={colors} />
          <FeatureItem icon="✓" text="Cloud backup & sync" colors={colors} />
          <FeatureItem icon="✓" text="Export to CSV & JSON" colors={colors} />
          <FeatureItem icon="✓" text="Tax summary reports" colors={colors} />
          <FeatureItem icon="✓" text="IRS mileage rate management" colors={colors} />
          <FeatureItem icon="✓" text="Priority support" colors={colors} />
        </View>
      </View>

      {/* Subscription Options */}
      <View style={styles.plansContainer}>
        {trialProduct && (
          <TouchableOpacity
            style={[
              styles.planCard,
              {
                backgroundColor: colors.surface,
                borderColor: selectedProduct === 'trial' ? colors.primary : colors.border,
                borderWidth: selectedProduct === 'trial' ? 2 : 1,
              },
              shadows.md,
            ]}
            onPress={() => setSelectedProduct('trial')}
          >
            <View style={[styles.popularBadge, { backgroundColor: colors.success }]}>
              <ThemedText style={[styles.popularText, { color: colors.textInverse }]}>
                FREE TRIAL
              </ThemedText>
            </View>

            <ThemedText type="subtitle" style={styles.planTitle}>
              30-Day Free Trial
            </ThemedText>
            <ThemedText type="title" style={styles.planPrice}>
              {String('localizedPrice' in trialProduct ? trialProduct.localizedPrice : (trialProduct.price || '0'))}
              <ThemedText style={styles.planPriceUnit}>/month</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.planBilled, { color: colors.textSecondary }]}>
              Free for 30 days, then {String('localizedPrice' in trialProduct ? trialProduct.localizedPrice : (trialProduct.price || '0'))}/month
            </ThemedText>
            <ThemedText style={[styles.planSavings, { color: colors.success }]}>
              Try it risk-free!
            </ThemedText>
          </TouchableOpacity>
        )}

        {annualProduct && (
          <TouchableOpacity
            style={[
              styles.planCard,
              {
                backgroundColor: colors.surface,
                borderColor: selectedProduct === 'annual' ? colors.primary : colors.border,
                borderWidth: selectedProduct === 'annual' ? 2 : 1,
              },
              shadows.md,
            ]}
            onPress={() => setSelectedProduct('annual')}
          >
            <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
              <ThemedText style={[styles.popularText, { color: colors.textInverse }]}>
                BEST VALUE
              </ThemedText>
            </View>

            <ThemedText type="subtitle" style={styles.planTitle}>
              Annual
            </ThemedText>
            <ThemedText type="title" style={styles.planPrice}>
              {String('localizedPrice' in annualProduct ? annualProduct.localizedPrice : (annualProduct.price || '0'))}
              <ThemedText style={styles.planPriceUnit}>/year</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.planBilled, { color: colors.textSecondary }]}>
              {('currency' in annualProduct ? annualProduct.currency : 'USD')} {(parseFloat(String(annualProduct.price || '0')) / 12).toFixed(2)}/month
            </ThemedText>
            <ThemedText style={[styles.planSavings, { color: colors.success }]}>
              Save 33%
            </ThemedText>
          </TouchableOpacity>
        )}

        {monthlyProduct && (
          <TouchableOpacity
            style={[
              styles.planCard,
              {
                backgroundColor: colors.surface,
                borderColor: selectedProduct === 'monthly' ? colors.primary : colors.border,
                borderWidth: selectedProduct === 'monthly' ? 2 : 1,
              },
              shadows.md,
            ]}
            onPress={() => setSelectedProduct('monthly')}
          >
            <ThemedText type="subtitle" style={styles.planTitle}>
              Monthly
            </ThemedText>
            <ThemedText type="title" style={styles.planPrice}>
              {String('localizedPrice' in monthlyProduct ? monthlyProduct.localizedPrice : (monthlyProduct.price || '0'))}
              <ThemedText style={styles.planPriceUnit}>/month</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.planBilled, { color: colors.textSecondary }]}>
              Billed monthly
            </ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {/* Subscribe Button */}
      <TouchableOpacity
        style={[styles.subscribeButton, { backgroundColor: colors.primary }]}
        onPress={handlePurchase}
        disabled={purchasing || loading}
      >
        {purchasing ? (
          <ActivityIndicator color={colors.textInverse} />
        ) : (
          <ThemedText style={[styles.subscribeButtonText, { color: colors.textInverse }]}>
            Start Subscription
          </ThemedText>
        )}
      </TouchableOpacity>

      {/* Restore Purchases */}
      <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={restoring}>
        {restoring ? (
          <ActivityIndicator color={colors.textSecondary} size="small" />
        ) : (
          <ThemedText style={[styles.restoreButtonText, { color: colors.textSecondary }]}>
            Restore Purchases
          </ThemedText>
        )}
      </TouchableOpacity>

      {/* Fine Print */}
      <ThemedText style={[styles.finePrint, { color: colors.textTertiary }]}>
        Subscriptions will automatically renew unless cancelled at least 24 hours before the end of
        the current period. Cancel anytime in App Store settings.
      </ThemedText>
    </ScrollView>
  );
}

interface FeatureItemProps {
  icon: string;
  text: string;
  colors: any;
}

function FeatureItem({ icon, text, colors }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <ThemedText style={[styles.featureIcon, { color: colors.success }]}>{icon}</ThemedText>
      <ThemedText style={styles.featureText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  logo: {
    width: 320,
    height: 110,
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
  },
  featuresContainer: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  featuresTitle: {
    marginBottom: Spacing.md,
  },
  featuresList: {
    gap: Spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    fontSize: 20,
    marginRight: Spacing.sm,
    fontWeight: 'bold',
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  plansContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  planCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  popularText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  planTitle: {
    marginBottom: Spacing.xs,
  },
  planPrice: {
    marginBottom: Spacing.xs,
  },
  planPriceUnit: {
    fontSize: 18,
    fontWeight: 'normal',
  },
  planBilled: {
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  planSavings: {
    fontSize: 16,
    fontWeight: '600',
  },
  subscribeButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  restoreButton: {
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  restoreButtonText: {
    fontSize: 14,
  },
  finePrint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
