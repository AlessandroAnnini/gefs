import { useColorScheme } from "nativewind";

export function useResolvedColorScheme() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  return { isDark, colorScheme: colorScheme ?? "light" };
}
