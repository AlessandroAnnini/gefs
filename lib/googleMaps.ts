import Constants from "expo-constants";

export function hasGoogleMapsApiKey(): boolean {
  return Constants.expoConfig?.extra?.hasGoogleMapsKey === true;
}
