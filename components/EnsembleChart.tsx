import { type WeatherVariable } from "@/services/openMeteo";
import { PrecipitationChart } from "./charts/PrecipitationChart";
import { EnsembleLineChart } from "./charts/EnsembleLineChart";

export function EnsembleChart({ variable }: { variable: WeatherVariable }) {
  if (variable === "precipitation") {
    return <PrecipitationChart variable={variable} />;
  }
  return <EnsembleLineChart variable={variable} />;
}
