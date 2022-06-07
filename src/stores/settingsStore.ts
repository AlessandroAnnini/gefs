import AsyncStorage from '@react-native-async-storage/async-storage';

import create from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set) => ({
        mode: '0',
        graph: '0',
        // duration: '0',
        // isMulti: false,
        color: '0',
        isLocationFromMap: false,
        time: Date.now(),
        scale: '0',
        isSearchingCoords: false,
        changeMode: (mode: string) => set(() => ({ mode })),
        toggleMode: () =>
          set((state) => ({ mode: state.mode === '0' ? '1' : '0' })),
        changeGraph: (graph) => set(() => ({ graph })),
        // changeDuration: (duration) => set(() => ({ duration })),
        // changeIsMulti: (isMulti) => set(() => ({ isMulti })),
        changeColor: (color) => set(() => ({ color })),
        toggleColor: () =>
          set((state) => ({ color: state.color === '0' ? '1' : '0' })),
        changeIsLocationFromMap: (isLocationFromMap) =>
          set(() => ({ isLocationFromMap })),
        updateTime: () => set(() => ({ time: Date.now() })),
        changeScale: (scale) => set(() => ({ scale })),
        changeIsSearchingCoords: (isSearchingCoords) =>
          set(() => ({ isSearchingCoords })),
      }),
      {
        name: 'settings-storage',
        getStorage: () => AsyncStorage,
      }
    )
  )
);
