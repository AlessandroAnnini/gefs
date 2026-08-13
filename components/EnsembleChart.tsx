import { type WeatherVariable } from "@/services/openMeteo";
import { PrecipitationChart } from "./charts/PrecipitationChart";
import { EnsembleLineChart } from "./charts/EnsembleLineChart";

interface EnsembleChartProps {
  hourly: Record<string, (number | null)[]>;
  variable: WeatherVariable;
  utcOffsetSeconds: number;
}

export function EnsembleChart({ hourly, variable, utcOffsetSeconds }: EnsembleChartProps) {
  if (variable === "precipitation") {
    return (
      <PrecipitationChart
        hourly={hourly}
        variable={variable}
        utcOffsetSeconds={utcOffsetSeconds}
      />
    );
  }
  return (
    <EnsembleLineChart
      hourly={hourly}
      variable={variable}
      utcOffsetSeconds={utcOffsetSeconds}
    />
  );
}
