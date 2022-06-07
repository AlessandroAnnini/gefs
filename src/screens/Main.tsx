import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';

import { View } from 'native-base';

import * as ScreenOrientation from 'expo-screen-orientation';

import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import shallow from 'zustand/shallow';

import { baseUrl, graphs } from '../constants';
import { useRun } from '../hooks';
import { useLocationStore, useSettingsStore } from '../stores';
import { Chart, Coordinates, Settings, VersionNo } from './../components';

type MainProps = NativeStackScreenProps<RootStackParamList, 'Main'>;

export const Main: React.FC = () => {
  const navigation = useNavigation<MainProps>();

  const { mode, scale, color } = useSettingsStore(
    (state: SettingsState) => ({
      mode: state.mode,
      scale: state.scale,
      color: state.color,
    }),
    shallow
  );

  const { latitude, longitude } = useLocationStore();
  const [isPortrait, setIsPortrait] = useState(true);
  const run = useRun();

  useEffect(() => {
    ScreenOrientation.getOrientationAsync().then((e) => {
      setIsPortrait(e === 1);
      StatusBar.setHidden(e !== 1);
    });
  }, []);

  useEffect(() => {
    ScreenOrientation.addOrientationChangeListener((e) => {
      setIsPortrait(e.orientationInfo.orientation === 1);
      StatusBar.setHidden(e.orientationInfo.orientation !== 1);
    });
    return () => {
      ScreenOrientation.removeOrientationChangeListeners();
    };
  }, []);

  const onRequestMap = () => navigation.navigate('Map');

  const items = graphs.map((g) => ({
    caption: g.label,
    source: {
      uri: `${baseUrl}mode=${scale}${g.value}x=0&y=0&run=${run}&lat=${latitude}&lon=${longitude}&runpara=0&ext=1&dmode=${mode}&col=${color}`,
    },
  }));

  const images = items.map((i) => ({ source: i.source }));
  const captions = items.map((i) => i.caption);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        {isPortrait ? <Settings onRequestMap={onRequestMap} /> : null}
        <Coordinates
          latitude={latitude}
          longitude={longitude}
          isPortrait={isPortrait}
        />
        <Chart images={images} captions={captions} />
        <VersionNo />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
