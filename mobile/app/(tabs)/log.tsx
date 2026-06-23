import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LogScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-bold text-foreground">Log</Text>
        <Text className="mt-2 text-center text-muted-foreground">
          Live workout logging with sets, reps, and rest timers will go here.
        </Text>
      </View>
    </SafeAreaView>
  );
}