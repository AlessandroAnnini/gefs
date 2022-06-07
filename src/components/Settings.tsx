import React, { useEffect } from 'react';

import { HStack, Icon, IconButton, Spinner, VStack } from 'native-base';

import {
  Feather,
  MaterialCommunityIcons,
  MaterialIcons,
} from '@native-base/icons';

import shallow from 'zustand/shallow';

import { ButtonIcon } from '../components';
import { useLocation } from './../hooks';
import { useSettingsStore } from './../stores';
import { ScaleSelect } from './ScaleSelect';

export const Settings: React.FC<Settings> = ({ onRequestMap }) => {
  const {
    mode,
    color,
    toggleMode,
    toggleColor,
    isLocationFromMap,
    updateTime,
    isSearchingCoords,
  } = useSettingsStore(
    (state: SettingsState) => ({
      mode: state.mode,
      color: state.color,
      toggleMode: state.toggleMode,
      toggleColor: state.toggleColor,
      isLocationFromMap: state.isLocationFromMap,
      updateTime: state.updateTime,
      isSearchingCoords: state.isSearchingCoords,
    }),
    shallow
  );

  const { findLocation } = useLocation();

  useEffect(() => {
    findLocation();
  }, []);

  return (
    <VStack space={3} style={{ padding: 12 }}>
      <HStack space={3} justifyContent="center" alignItems="flex-end">
        <ScaleSelect />
        <ButtonIcon
          onPress={onRequestMap}
          icon={<Icon as={Feather} name="map" />}
        />
        {isSearchingCoords ? (
          <Spinner color="cyan.500" style={{ width: 43, height: 45 }} />
        ) : (
          <ButtonIcon
            onPress={findLocation}
            value={isLocationFromMap}
            icons={[
              <Icon as={MaterialIcons} name="gps-not-fixed" />,
              <Icon as={MaterialIcons} name="gps-fixed" />,
            ]}
          />
        )}
        <ButtonIcon
          onPress={toggleMode}
          value={mode === '0'}
          icons={[
            <Icon as={MaterialCommunityIcons} name="texture-box" />,
            <Icon
              as={MaterialCommunityIcons}
              name="chart-bell-curve-cumulative"
            />,
          ]}
        />
        <ButtonIcon
          onPress={toggleColor}
          value={color === '0'}
          icons={[
            <Icon as={Feather} name="moon" />,
            <Icon as={Feather} name="sun" />,
          ]}
        />
        <IconButton
          style={{ width: 43, height: 45 }}
          onPress={updateTime}
          variant="outline"
          icon={<Icon as={Feather} name="refresh-cw" />}
        />
      </HStack>
    </VStack>
  );
};
