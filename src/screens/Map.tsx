import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Button, Dimensions } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker } from 'react-native-maps';

import shallow from 'zustand/shallow';

import { FontAwesome } from '@expo/vector-icons';

import { useLocation } from '../hooks';
import { useSettingsStore } from '../stores';

type MapProps = NativeStackScreenProps<RootStackParamList, 'Map'>;

export const Map: React.FC = () => {
  const navigation = useNavigation<MapProps>();

  const { changeIsLocationFromMap } = useSettingsStore(
    (state: SettingsState) => ({
      changeIsLocationFromMap: state.changeIsLocationFromMap,
    }),
    shallow
  );

  const { getLocation, setLocation } = useLocation();
  const [latitudeDelta] = useState(0.5);
  const [longitudeDelta, setLongitudeDelta] = useState(0);
  const [region, setRegion] = useState<any>();
  const [markerPosition, setMarkerPosition] = useState<any>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button onPress={() => navigation.navigate('Main')} title="OK" />
      ),
    });
  }, [navigation]);

  useEffect(() => {
    console.log('init');
    const { width, height } = Dimensions.get('window');
    const ASPECT_RATIO = width / height;
    setLongitudeDelta(latitudeDelta * ASPECT_RATIO);

    const { latitude, longitude } = getLocation();

    setRegion({
      latitude,
      longitude,
      latitudeDelta,
      longitudeDelta,
    });

    setMarkerPosition({ latitude, longitude });
  }, []);

  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={region}
      onRegionChangeComplete={(e) => {
        const { latitude, longitude } = e;
        setLocation({ latitude, longitude });
        changeIsLocationFromMap(true);
      }}
      onRegionChange={(e) => {
        const { latitude, longitude } = e;
        setMarkerPosition({ latitude, longitude });
      }}
    >
      {markerPosition ? (
        <Marker coordinate={markerPosition}>
          <FontAwesome size={44} name="map-pin" style={{ color: 'red' }} />
        </Marker>
      ) : null}
    </MapView>
  );
};
