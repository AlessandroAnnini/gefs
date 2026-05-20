import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

export const NAV_THEME: Record<"light" | "dark", Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: "hsl(0, 0%, 100%)",
      border: "hsl(240, 5.9%, 90%)",
      card: "hsl(0, 0%, 100%)",
      notification: "hsl(0, 84.2%, 60.2%)",
      primary: "hsl(199, 89%, 48%)",
      text: "hsl(240, 10%, 3.9%)",
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: "hsl(222, 47%, 6%)",
      border: "hsl(217, 33%, 17%)",
      card: "hsl(222, 47%, 8%)",
      notification: "hsl(0, 70.9%, 59.4%)",
      primary: "hsl(199, 89%, 48%)",
      text: "hsl(210, 40%, 98%)",
    },
  },
};
