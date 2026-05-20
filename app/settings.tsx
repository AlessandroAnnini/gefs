import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore } from "@/stores";
import {
  ENSEMBLE_MODELS,
  WEATHER_VARIABLES,
  VARIABLE_LABELS,
  type EnsembleModel,
  type WeatherVariable,
} from "@/services/openMeteo";
import { useShallow } from "zustand/react/shallow";
import { Ionicons } from "@expo/vector-icons";
import { useResolvedColorScheme } from "@/lib/useResolvedColorScheme";

const FORECAST_DAY_OPTIONS = [3, 5, 7, 10, 14];
const COLOR_SCHEME_OPTIONS = ["system", "light", "dark"] as const;

function OptionRow({
  label,
  selected,
  onPress,
  iconColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  iconColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-3 px-2"
    >
      <Text className={selected ? "text-primary font-semibold" : "text-foreground"}>
        {label}
      </Text>
      {selected && <Ionicons name="checkmark" size={20} color={iconColor} />}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { isDark } = useResolvedColorScheme();
  const iconColor = isDark ? "#38bdf8" : "#0891b2";

  const {
    model,
    forecastDays,
    variables,
    colorScheme,
    showYAxisUnits,
    setModel,
    setForecastDays,
    setVariables,
    setColorScheme,
    setShowYAxisUnits,
  } = useSettingsStore(
    useShallow((s) => ({
      model: s.model,
      forecastDays: s.forecastDays,
      variables: s.variables,
      colorScheme: s.colorScheme,
      showYAxisUnits: s.showYAxisUnits,
      setModel: s.setModel,
      setForecastDays: s.setForecastDays,
      setVariables: s.setVariables,
      setColorScheme: s.setColorScheme,
      setShowYAxisUnits: s.setShowYAxisUnits,
    }))
  );

  const toggleVariable = (v: WeatherVariable) => {
    if (variables.includes(v)) {
      if (variables.length > 1) {
        setVariables(variables.filter((x) => x !== v));
      }
    } else {
      setVariables([...variables, v]);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="p-4 gap-4">
        <Card className="p-4">
          <Text variant="h4" className="mb-3">
            Model
          </Text>
          {(Object.entries(ENSEMBLE_MODELS) as [EnsembleModel, string][]).map(
            ([key, label]) => (
              <OptionRow
                key={key}
                label={label}
                selected={model === key}
                onPress={() => setModel(key)}
                iconColor={iconColor}
              />
            )
          )}
        </Card>

        <Card className="p-4">
          <Text variant="h4" className="mb-3">
            Forecast Days
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {FORECAST_DAY_OPTIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setForecastDays(d)}
                className={`px-4 py-2 rounded-lg border ${
                  forecastDays === d
                    ? "bg-primary border-primary"
                    : "border-border bg-muted/30"
                }`}
              >
                <Text
                  className={
                    forecastDays === d
                      ? "text-primary-foreground font-semibold"
                      : "text-foreground"
                  }
                >
                  {d}d
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card className="p-4">
          <Text variant="h4" className="mb-3">
            Variables
          </Text>
          {WEATHER_VARIABLES.map((v, i) => (
            <View key={v}>
              {i > 0 && <Separator className="my-1" />}
              <OptionRow
                label={VARIABLE_LABELS[v]}
                selected={variables.includes(v)}
                onPress={() => toggleVariable(v)}
                iconColor={iconColor}
              />
            </View>
          ))}
        </Card>

        <Card className="p-4">
          <Text variant="h4" className="mb-3">
            Appearance
          </Text>
          {COLOR_SCHEME_OPTIONS.map((scheme) => (
            <OptionRow
              key={scheme}
              label={scheme.charAt(0).toUpperCase() + scheme.slice(1)}
              selected={colorScheme === scheme}
              onPress={() => setColorScheme(scheme)}
              iconColor={iconColor}
            />
          ))}
        </Card>

        <Card className="p-4">
          <Text variant="h4" className="mb-3">
            Charts
          </Text>
          <OptionRow
            label="Show units on Y-axis"
            selected={showYAxisUnits}
            onPress={() => setShowYAxisUnits(!showYAxisUnits)}
            iconColor={iconColor}
          />
        </Card>

        <Text variant="muted" className="text-center mt-2">
          v3.2.0
        </Text>
      </View>
    </ScrollView>
  );
}
