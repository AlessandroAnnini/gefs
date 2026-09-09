import { useMemo } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { EnsembleChart } from "./EnsembleChart";
import { ChartSyncProvider } from "./charts/ChartSync";
import { ChartFontsProvider } from "./charts/ChartFonts";
import {
  ENSEMBLE_MODELS,
  isCoverageError,
  trimHourlyToSharedTail,
  useEnsembleData,
  type EnsembleModel,
  type WeatherVariable,
} from "@/services/openMeteo";
import { useLocationStore, useSettingsStore, useStoresHydrated } from "@/stores";
import { useShallow } from "zustand/react/shallow";
import { useLocation } from "@/hooks";

export function ChartList() {
  const router = useRouter();
  const hydrated = useStoresHydrated();
  const { findLocation } = useLocation();
  const latitude = useLocationStore((s) => s.latitude);
  const longitude = useLocationStore((s) => s.longitude);
  const isSearching = useLocationStore((s) => s.isSearching);
  const permissionDenied = useLocationStore((s) => s.permissionDenied);
  const errorMessage = useLocationStore((s) => s.errorMessage);
  const { model, forecastDays, variables } = useSettingsStore(
    useShallow((s) => ({
      model: s.model,
      forecastDays: s.forecastDays,
      variables: s.variables,
    }))
  );

  const { data, isLoading, isError, error, refetch, isRefetching } = useEnsembleData(
    hydrated ? latitude : null,
    hydrated ? longitude : null,
    variables,
    model,
    forecastDays
  );

  const hourly = useMemo(() => {
    if (!data?.hourly) return null;
    return trimHourlyToSharedTail(data.hourly, variables);
  }, [data?.hourly, variables]);

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="small" className="mb-2" />
        <Text variant="muted" className="text-center">
          Loading settings...
        </Text>
      </View>
    );
  }

  if (latitude == null || longitude == null) {
    if (permissionDenied || errorMessage) {
      const message = permissionDenied
        ? "Location permission denied. Pick a point on the map, or enable location and retry."
        : errorMessage ?? "Could not get GPS position.";
      return (
        <View className="flex-1 items-center justify-center p-8 gap-4">
          <Text variant="muted" className="text-center">
            {message}
          </Text>
          <View className="flex-row gap-2">
            <Button variant="outline" onPress={findLocation} disabled={isSearching}>
              <Text>Retry GPS</Text>
            </Button>
            <Button onPress={() => router.push("/map")}>
              <Text className="text-primary-foreground">Open map</Text>
            </Button>
          </View>
        </View>
      );
    }

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

  const openSettings = () => router.push("/settings");
  const openMap = () => router.push("/map");

  if (isError) {
    if (isCoverageError(error)) {
      return <CoverageEmpty model={model} onSettings={openSettings} onMap={openMap} />;
    }
    return (
      <View className="flex-1 items-center justify-center p-8 gap-4">
        <Text variant="muted" className="text-center">
          Could not load the forecast. Check your connection and try again.
        </Text>
        <Button variant="outline" onPress={() => refetch()}>
          <Text>Retry</Text>
        </Button>
      </View>
    );
  }

  if (!hourly || !data) return null;

  if ((hourly.time?.length ?? 0) === 0) {
    return <CoverageEmpty model={model} onSettings={openSettings} onMap={openMap} />;
  }

  const syncKey = `${latitude},${longitude},${model},${forecastDays},${variables.join(",")}`;

  return (
    <ChartFontsProvider>
      <ChartSyncProvider key={syncKey}>
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        >
          {variables.map((v: WeatherVariable) => (
            <View
              key={v}
              className="mb-4"
              style={{ height: v === "precipitation" ? 400 : 300 }}
            >
              <EnsembleChart
                hourly={hourly}
                variable={v}
                utcOffsetSeconds={data.utc_offset_seconds ?? 0}
              />
            </View>
          ))}
          <View style={{ height: 48 }} />
        </ScrollView>
      </ChartSyncProvider>
    </ChartFontsProvider>
  );
}

function CoverageEmpty({
  model,
  onSettings,
  onMap,
}: {
  model: EnsembleModel;
  onSettings: () => void;
  onMap: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center p-8 gap-4">
      <Text variant="muted" className="text-center">
        {ENSEMBLE_MODELS[model]} does not cover this location. Pick a different
        model, or move the pin.
      </Text>
      <View className="flex-row gap-2">
        <Button variant="outline" onPress={onMap}>
          <Text>Open map</Text>
        </Button>
        <Button onPress={onSettings}>
          <Text className="text-primary-foreground">Change model</Text>
        </Button>
      </View>
    </View>
  );
}
