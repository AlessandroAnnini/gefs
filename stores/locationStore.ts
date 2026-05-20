import { create } from "zustand";

interface LocationState {
  latitude: number;
  longitude: number;
  isSearching: boolean;
  setLocation: (lat: number, lon: number) => void;
  setIsSearching: (v: boolean) => void;
}

export const useLocationStore = create<LocationState>()((set) => ({
  latitude: 0,
  longitude: 0,
  isSearching: false,
  setLocation: (latitude, longitude) => set({ latitude, longitude }),
  setIsSearching: (isSearching) => set({ isSearching }),
}));
