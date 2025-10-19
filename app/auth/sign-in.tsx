import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColors, useShadows } from '@/constants/Design';
import { signIn } from '@/services/authService';

export default function SignInScreen() {
  const colors = useColors();
  const shadows = useShadows();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      const { user, error } = await signIn(email, password);

      if (error) {
        Alert.alert('Sign In Failed', error.message);
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
            <ThemedText type="title" style={styles.title}>
              Welcome Back
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in to access your mileage tracker
            </ThemedText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
                Email
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                  shadows.sm,
                ]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
                Password
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                  shadows.sm,
                ]}
                placeholder="Enter your password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={[styles.buttonText, { color: colors.textInverse }]}>
                  Sign In
                </ThemedText>
              )}
            </TouchableOpacity>

            {/* Links */}
            <View style={styles.links}>
              <ThemedText style={{ color: colors.textSecondary }}>
                Don't have an account?{' '}
                <Link href="/auth/sign-up" style={{ color: colors.primary }}>
                  Sign Up
                </Link>
              </ThemedText>
            </View>
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
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  links: {
    marginTop: 24,
    alignItems: 'center',
  },
});
