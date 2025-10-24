import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { ThemedText } from './themed-text';
import { useColors } from '@/constants/Design';

interface LoadingAnimationProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
}

export function LoadingAnimation({ text = 'Loading...', size = 'large' }: LoadingAnimationProps) {
  const colors = useColors();

  // Animation values
  const carPosition = useRef(new Animated.Value(0)).current;
  const roadLine1 = useRef(new Animated.Value(0)).current;
  const roadLine2 = useRef(new Animated.Value(0)).current;
  const roadLine3 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const sizeConfig = {
    small: { containerSize: 60, carSize: 24, lineHeight: 2, lineWidth: 20 },
    medium: { containerSize: 80, carSize: 32, lineHeight: 3, lineWidth: 30 },
    large: { containerSize: 100, carSize: 40, lineHeight: 4, lineWidth: 40 },
  };

  const config = sizeConfig[size];

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Car bounce animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(carPosition, {
          toValue: -8,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(carPosition, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Road line animations (staggered for moving effect)
    const animateRoadLine = (line: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(line, {
            toValue: 1,
            duration: 800,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(line, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    animateRoadLine(roadLine1, 0).start();
    animateRoadLine(roadLine2, 266).start();
    animateRoadLine(roadLine3, 533).start();

    // Pulse animation for glow effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [carPosition, roadLine1, roadLine2, roadLine3, pulseAnim, fadeAnim]);

  // Interpolate road line positions
  const getRoadLineStyle = (animValue: Animated.Value) => ({
    opacity: animValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 0.5, 0],
    }),
    transform: [
      {
        translateX: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, config.containerSize],
        }),
      },
    ],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        {/* Pulsing background circle */}
        <Animated.View
          style={[
            styles.pulseCircle,
            {
              width: config.containerSize,
              height: config.containerSize,
              backgroundColor: `${colors.primary}15`,
              borderColor: `${colors.primary}30`,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Road container */}
        <View style={[styles.roadContainer, { width: config.containerSize, height: config.containerSize }]}>
          {/* Road lines */}
          <Animated.View
            style={[
              styles.roadLine,
              {
                height: config.lineHeight,
                width: config.lineWidth,
                backgroundColor: colors.primary,
              },
              getRoadLineStyle(roadLine1),
            ]}
          />
          <Animated.View
            style={[
              styles.roadLine,
              {
                height: config.lineHeight,
                width: config.lineWidth,
                backgroundColor: colors.primary,
              },
              getRoadLineStyle(roadLine2),
            ]}
          />
          <Animated.View
            style={[
              styles.roadLine,
              {
                height: config.lineHeight,
                width: config.lineWidth,
                backgroundColor: colors.primary,
              },
              getRoadLineStyle(roadLine3),
            ]}
          />

          {/* Car icon */}
          <Animated.View
            style={[
              styles.carContainer,
              {
                transform: [{ translateY: carPosition }],
              },
            ]}
          >
            <ThemedText style={[styles.carIcon, { fontSize: config.carSize }]}>🚗</ThemedText>
          </Animated.View>
        </View>
      </View>

      {/* Loading text */}
      {text && (
        <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
          {text}
        </ThemedText>
      )}
    </Animated.View>
  );
}

// Simple spinner variant for inline use
export function LoadingSpinner({ size = 24, color }: { size?: number; color?: string }) {
  const colors = useColors();
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.spinner,
        {
          width: size,
          height: size,
          borderColor: `${color || colors.primary}20`,
          borderTopColor: color || colors.primary,
          borderWidth: size / 8,
          borderRadius: size / 2,
          transform: [{ rotate: spin }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  content: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  roadContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  roadLine: {
    position: 'absolute',
    borderRadius: 2,
  },
  carContainer: {
    zIndex: 10,
  },
  carIcon: {
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  spinner: {
    borderStyle: 'solid',
  },
});
