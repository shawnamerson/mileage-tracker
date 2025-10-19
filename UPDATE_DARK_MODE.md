# Dark Mode Updates

## Pattern to apply to all tab screens:

1. Import: `import { useColors, Spacing, ... } from '@/constants/Design';`
2. Hook: `const colors = useColors();`
3. Container: `style={[styles.container, { backgroundColor: colors.background }]}`
4. Cards/Surfaces: `style={[styles.card, { backgroundColor: colors.surface }]}`
5. Primary text: `style={[styles.text, { color: colors.primary }]}`
6. Remove backgroundColor from static styles where it needs to be dynamic

## Files to update:
- ✓ app/(tabs)/index.tsx - partial
- app/(tabs)/history.tsx
- app/(tabs)/add.tsx
- app/(tabs)/stats.tsx
- app/(tabs)/settings.tsx
