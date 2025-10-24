# LoadingAnimation Component

A modern, animated loading component designed for the Mileage Tracker app with a car-themed animation.

## Features

- **Animated car with moving road lines** - Perfect for a mileage tracking app
- **Pulsing background effect** - Smooth visual feedback
- **Customizable sizes** - Small, medium, or large
- **Themed colors** - Automatically adapts to light/dark mode
- **Smooth fade-in animation** - Professional appearance
- **Inline spinner variant** - For buttons and small spaces

## Usage

### Full-screen loading (with car animation)

```tsx
import { LoadingAnimation } from '@/components/LoadingAnimation';

// In your component
if (loading) {
  return (
    <ThemedView style={styles.loadingContainer}>
      <LoadingAnimation text="Loading your trips..." />
    </ThemedView>
  );
}
```

### Different sizes

```tsx
// Large (default) - 100px
<LoadingAnimation text="Loading..." size="large" />

// Medium - 80px
<LoadingAnimation text="Loading..." size="medium" />

// Small - 60px
<LoadingAnimation text="Loading..." size="small" />

// No text
<LoadingAnimation />
```

### Inline spinner (for buttons)

```tsx
import { LoadingSpinner } from '@/components/LoadingAnimation';

<TouchableOpacity
  style={styles.button}
  disabled={loading}
>
  {loading ? (
    <LoadingSpinner color="#fff" size={20} />
  ) : (
    <Text>Export Data</Text>
  )}
</TouchableOpacity>
```

## Props

### LoadingAnimation

- `text?: string` - Optional loading text (default: "Loading...")
- `size?: 'small' | 'medium' | 'large'` - Size of the animation (default: 'large')

### LoadingSpinner

- `size?: number` - Size in pixels (default: 24)
- `color?: string` - Spinner color (defaults to theme primary color)

## Examples in the app

- **Dashboard** (`app/(tabs)/index.tsx`) - Full screen loading
- **Settings** (`app/(tabs)/settings.tsx`) - Full screen loading + button spinners
- Export buttons - Inline spinners

## Animation Details

The car animation includes:
1. **Bouncing car** - Simulates driving motion
2. **Moving road lines** - Creates sense of movement
3. **Pulsing glow** - Draws attention
4. **Smooth fade in** - Professional entrance

All animations are optimized using `useNativeDriver: true` for 60fps performance.
