import create from 'zustand';
import { devtools } from 'zustand/middleware';

export const useLocationStore = create<LocationState>()(
  devtools((set) => ({
    latitude: 0,
    longitude: 0,
    changeLocation: (location) =>
      set(() => ({
        latitude: location.latitude,
        longitude: location.longitude,
      })),
  }))
);
