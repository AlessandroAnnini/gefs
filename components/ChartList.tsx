import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { EnsembleChart } from "./EnsembleChart";
import { useEnsembleData, type WeatherVariable } from "@/services/openMeteo";
import { useLocationStore, useSettingsStore } from "@/stores";
import { useShallow } from "zustand/react/shallow";

export function ChartList() {
  const { latitude, longitude } = useLocationStore();
  const { model, forecastDays, variables } = useSettingsStore(
    useShallow((s) => ({
      model: s.model,
      forecastDays: s.forecastDays,
      variables: s.variables,
    }))
  );

  const { data, isLoading, isError, error, refetch, isRefetching } = useEnsembleData(
    latitude,
    longitude,
    variables,
    model,
    forecastDays
  );

  if (latitude === 0 && longitude === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="small" className="mb-2" />
        <Text variant="muted" className="text-center">
          Acquiring GPS location...
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
        <Text variant="muted" className="mt-3">
          Loading ensemble data...
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center p-8 gap-4">
        <Text variant="muted" className="text-center">
          {error?.message ?? "Failed to load forecast data"}
        </Text>
        <Button variant="outline" onPress={() => refetch()}>
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  if (!data?.hourly) return null;

  return (
    <ScrollView
      className="flex-1"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
    >
      {variables.map((v: WeatherVariable) => (
        <View
          key={v}
          className="mb-4"
          style={{ height: v === "precipitation" ? 380 : 300 }}
        >
          <EnsembleChart hourly={data.hourly} variable={v} />
        </View>
      ))}
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}
