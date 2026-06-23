import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-end px-4 pt-2">
        <Link href="/import" asChild>
          <Pressable
            className="flex-row items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="Import workouts">
            <Ionicons name="cloud-upload-outline" size={18} color="#a2eb3c" />
            <Text className="text-sm font-medium text-highlight">Import</Text>
          </Pressable>
        </Link>
      </View>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-bold text-foreground">Dashboard</Text>
        <Text className="mt-2 text-center text-muted-foreground">
          Your training overview and recent PRs will live here.
        </Text>
      </View>
    </SafeAreaView>
  );
}