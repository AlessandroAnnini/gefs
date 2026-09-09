import "../global.css";

import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { PortalHost } from "@rn-primitives/portal";

import { queryClient } from "@/lib/queryClient";
import { NAV_THEME } from "@/lib/theme";
import { useSettingsStore, useStoresHydrated } from "@/stores";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return <RootLayoutNav />;
}

function HideSplashWhenReady() {
  const hydrated = useStoresHydrated();

  useEffect(() => {
    if (hydrated) void SplashScreen.hideAsync();
  }, [hydrated]);

  return null;
}

function RootLayoutNav() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const userPref = useSettingsStore((s) => s.colorScheme);

  useEffect(() => {
    setColorScheme(userPref === "system" ? "system" : userPref);
  }, [userPref, setColorScheme]);

  const isDark = colorScheme === "dark";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HideSplashWhenReady />
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeProvider value={NAV_THEME[isDark ? "dark" : "light"]}>
            <StatusBar style={isDark ? "light" : "dark"} />
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen
                name="settings"
                options={{
                  presentation: "modal",
                  headerShown: true,
                  title: "Settings",
                  headerStyle: {
                    backgroundColor: isDark ? "hsl(222, 47%, 6%)" : "hsl(0, 0%, 100%)",
                  },
                  headerTintColor: isDark ? "hsl(210, 40%, 98%)" : "hsl(240, 10%, 3.9%)",
                }}
              />
              <Stack.Screen
                name="map"
                options={{
                  presentation: "modal",
                  headerShown: true,
                  title: "Pick Location",
                  headerStyle: {
                    backgroundColor: isDark ? "hsl(222, 47%, 6%)" : "hsl(0, 0%, 100%)",
                  },
                  headerTintColor: isDark ? "hsl(210, 40%, 98%)" : "hsl(240, 10%, 3.9%)",
                }}
              />
            </Stack>
            <PortalHost />
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
