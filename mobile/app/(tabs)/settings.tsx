import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-bold text-foreground">Settings</Text>
        <Text className="mt-2 text-center text-muted-foreground">
          Units, bar weight, plates, and data export options will live here.
        </Text>
      </View>
    </SafeAreaView>
  );
}