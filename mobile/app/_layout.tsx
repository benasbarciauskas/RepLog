import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { repository } from '@/data/sqliteRepository';

export default function RootLayout() {
  useEffect(() => {
    void repository.getSettings();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="import"
          options={{
            presentation: 'card',
            headerShown: true,
            title: 'Import',
            headerStyle: { backgroundColor: '#0c0d0f' },
            headerTintColor: '#f4f5f6',
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}