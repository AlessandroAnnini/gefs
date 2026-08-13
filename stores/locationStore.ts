import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  isSearching: boolean;
  permissionDenied: boolean;
  errorMessage: string | null;
  setLocation: (lat: number, lon: number) => void;
  setIsSearching: (v: boolean) => void;
  setPermissionDenied: (v: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      latitude: null,
      longitude: null,
      isSearching: false,
      permissionDenied: false,
      errorMessage: null,
      setLocation: (latitude, longitude) =>
        set({
          latitude,
          longitude,
          permissionDenied: false,
          errorMessage: null,
        }),
      setIsSearching: (isSearching) => set({ isSearching }),
      setPermissionDenied: (permissionDenied) => set({ permissionDenied }),
      setErrorMessage: (errorMessage) => set({ errorMessage }),
    }),
    {
      name: "gefs-location",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        latitude: s.latitude,
        longitude: s.longitude,
      }),
    }
  )
);
