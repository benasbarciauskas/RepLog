import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-bold text-foreground">History</Text>
        <Text className="mt-2 text-center text-muted-foreground">
          Past workouts and exercise progress charts will be listed here.
        </Text>
      </View>
    </SafeAreaView>
  );
}