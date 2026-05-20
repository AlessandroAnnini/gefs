import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useResolvedColorScheme } from "@/lib/useResolvedColorScheme";

export default function TabLayout() {
  const { isDark } = useResolvedColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0ea5e9",
        tabBarInactiveTintColor: isDark ? "#64748b" : "#94a3b8",
        tabBarStyle: {
          backgroundColor: isDark ? "hsl(222, 47%, 6%)" : "hsl(0, 0%, 100%)",
          borderTopColor: isDark ? "hsl(217, 33%, 17%)" : "hsl(240, 5.9%, 90%)",
        },
        headerStyle: {
          backgroundColor: isDark ? "hsl(222, 47%, 6%)" : "hsl(0, 0%, 100%)",
        },
        headerTintColor: isDark ? "hsl(210, 40%, 98%)" : "hsl(240, 10%, 3.9%)",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Forecast",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
