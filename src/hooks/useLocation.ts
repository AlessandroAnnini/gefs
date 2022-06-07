import { useEffect, useState } from 'react';

import * as Location from 'expo-location';

import shallow from 'zustand/shallow';

import { useLocationStore, useSettingsStore } from '../stores';

export const useLocation = () => {
  const [error, setError] = useState<string>('');
  const { latitude, longitude, changeLocation } = useLocationStore();
  const { time, changeIsLocationFromMap, changeIsSearchingCoords } =
    useSettingsStore(
      (state: SettingsState) => ({
        time: state.time,
        changeIsLocationFromMap: state.changeIsLocationFromMap,
        changeIsSearchingCoords: state.changeIsSearchingCoords,
      }),
      shallow
    );

  const findLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access location was denied');
      return;
    }

    changeIsSearchingCoords(true);
    const location = await Location.getCurrentPositionAsync({});
    const nextLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    changeLocation(nextLocation);
    changeIsLocationFromMap(false);
    changeIsSearchingCoords(false);
  };

  useEffect(() => {
    findLocation();
  }, [time]);

  const getLocation = () => ({ latitude, longitude });

  type Location = {
    latitude: number;
    longitude: number;
  };

  const setLocation = async ({ latitude, longitude }: Location) => {
    const nextLocation = {
      latitude,
      longitude,
    };
    changeLocation(nextLocation);
    changeIsLocationFromMap(true);
    changeIsSearchingCoords(false);
  };

  return {
    findLocation,
    getLocation,
    setLocation,
    error,
  };
};
