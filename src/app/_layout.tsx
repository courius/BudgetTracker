import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { collectDetected } from '@/lib/bankNotifications';
import { useStore } from '@/lib/store';
import { sync } from '@/lib/sync';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);

  // Every time the app comes to the front: pick up detected expenses and flush the outbox.
  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => {
      collectDetected();
      void sync();
    };
    refresh();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => sub.remove();
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', headerBackTitle: 'Back' }} />
      </Stack>
    </>
  );
}
