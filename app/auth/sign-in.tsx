import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColors, useShadows } from '@/constants/Design';
import { signInWithApple, isAppleAuthAvailable } from '@/services/authService';

export default function SignInScreen() {
  const colors = useColors();
  const shadows = useShadows();
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  useEffect(() => {
    // Check if Apple Auth is available
    isAppleAuthAvailable().then(setAppleAuthAvailable);
  }, []);

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const { user, error } = await signInWithApple();

      if (error) {
        if (error.message !== 'Sign in cancelled') {
          Alert.alert('Sign In Failed', error.message);
        }
        return;
      }

      if (user) {
        // Navigation is handled automatically by AuthContext
        console.log('Signed in successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedView style={styles.content}>
          {/* Logo/Title */}
          <View style={styles.header}>
            <Image
              source={require('@/assets/images/wordmark.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <ThemedText type="title" style={styles.title}>
              Welcome to MileMate
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in with Apple to continue
            </ThemedText>
          </View>

          {/* Apple Sign In Button */}
          <View style={styles.form}>
            {appleAuthAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
                disabled={loading}
              />
            ) : (
              <View style={[styles.appleButton, styles.unavailableButton]}>
                <ThemedText style={styles.unavailableText}>
                  Apple Sign In not available on this device
                </ThemedText>
              </View>
            )}

            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            )}
          </View>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 380,
    height: 130,
    marginBottom: 24,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  appleButton: {
    width: '100%',
    height: 50,
  },
  unavailableButton: {
    backgroundColor: '#ccc',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unavailableText: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingOverlay: {
    marginTop: 20,
    alignItems: 'center',
  },
});
