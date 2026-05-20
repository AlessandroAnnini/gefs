import { Link, Stack } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View className="flex-1 items-center justify-center p-8 bg-background">
        <Text variant="h3">Page not found</Text>
        <Link href="/" className="mt-4">
          <Text className="text-primary underline">Go to forecast</Text>
        </Link>
      </View>
    </>
  );
}
