import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/Design';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch React errors and prevent app crashes
 * Wraps components to gracefully handle errors
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // In production, you would send this to your error tracking service
    // e.g., Sentry, Bugsnag, etc.
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <ThemedView style={styles.container}>
          <View style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              Oops! Something went wrong
            </ThemedText>
            <ThemedText style={styles.message}>
              We encountered an unexpected error. Don't worry, your data is safe.
            </ThemedText>
            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <ThemedText style={styles.errorText}>
                  {this.state.error.toString()}
                </ThemedText>
              </View>
            )}
            <TouchableOpacity
              style={styles.button}
              onPress={this.handleReset}
            >
              <ThemedText style={styles.buttonText}>Try Again</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    marginBottom: Spacing.lg,
    textAlign: 'center',
    color: Colors.error,
  },
  message: {
    marginBottom: Spacing.xl,
    textAlign: 'center',
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  errorDetails: {
    padding: Spacing.md,
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    width: '100%',
  },
  errorText: {
    fontSize: Typography.sm,
    color: Colors.error,
    fontFamily: 'monospace',
  },
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
  },
  buttonText: {
    color: Colors.textInverse,
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
  },
});
