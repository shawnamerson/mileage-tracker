import { Stack } from 'expo-router';

export default function SubscriptionLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
