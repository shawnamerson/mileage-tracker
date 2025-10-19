/**
 * Modern Design System for Mileage Tracker
 * Contemporary colors, spacing, and typography with dark mode support
 */

import { useColorScheme } from 'react-native';

export const LightColors = {
  // Primary Brand Colors
  primary: '#6366F1', // Modern indigo
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',

  // Accent Colors
  accent: '#10B981', // Modern emerald green
  accentLight: '#34D399',
  accentDark: '#059669',

  // Status Colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Neutral Colors
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceLight: '#F3F4F6',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Text Colors
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Purpose Colors
  business: '#6366F1',
  personal: '#8B5CF6',
  medical: '#EC4899',
  charity: '#F59E0B',
  other: '#6B7280',
};

export const DarkColors = {
  // Primary Brand Colors
  primary: '#8B5CF6', // Vibrant purple for dark mode
  primaryLight: '#A78BFA',
  primaryDark: '#7C3AED',

  // Accent Colors
  accent: '#10B981', // Emerald green
  accentLight: '#34D399',
  accentDark: '#059669',

  // Status Colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Neutral Colors - True Black Theme
  background: '#000000', // Pure black for OLED
  surface: '#121212', // Elevated surface (Google Material Design)
  surfaceLight: '#1E1E1E', // Lighter elevated surface
  border: '#2A2A2A', // Subtle borders
  borderLight: '#1E1E1E', // Very subtle borders

  // Text Colors - High Contrast
  text: '#FFFFFF', // Pure white for maximum contrast
  textSecondary: '#A1A1A1', // Medium gray
  textTertiary: '#6B6B6B', // Darker gray
  textInverse: '#000000', // Black text for light backgrounds

  // Purpose Colors - Vibrant for dark mode
  business: '#8B5CF6',
  personal: '#A78BFA',
  medical: '#F472B6',
  charity: '#FBBF24',
  other: '#9CA3AF',
};

// Static colors export for use in StyleSheet.create (uses light colors)
// For dynamic dark mode support, use useColors() hook instead
export const Colors = LightColors;

// Hook to get theme-aware colors
export function useColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DarkColors : LightColors;
}

// Helper to get colors synchronously (for use outside components)
export function getColors(scheme: 'light' | 'dark' | null | undefined) {
  return scheme === 'dark' ? DarkColors : LightColors;
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
};

// Dark mode shadows (lighter and more subtle for black backgrounds)
export const DarkShadows = {
  sm: {
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 6,
  },
  xl: {
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 10,
  },
};

// Hook to get theme-aware shadows
export function useShadows() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DarkShadows : Shadows;
}

export const Typography = {
  // Font Sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,

  // Font Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Layout = {
  screenPadding: Spacing.md,
  cardPadding: Spacing.md,
  sectionSpacing: Spacing.lg,
};
