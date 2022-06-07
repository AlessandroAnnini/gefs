import React from 'react';

import { NativeBaseProvider, extendTheme } from 'native-base';

import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';

import { NavigationContainer } from '@react-navigation/native';
import { enableLatestRenderer } from 'react-native-maps';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import shallow from 'zustand/shallow';

import { StackNavigator } from './src/Navigator';
import { useSettingsStore } from './src/stores';

enableLatestRenderer();

export default () => {
  const { color } = useSettingsStore(
    (state: SettingsState) => ({
      color: state.color,
    }),
    shallow
  );

  const components = {
    View: {
      baseStyle: () => ({
        backgroundColor: color === '0' ? 'transparent' : 'black',
      }),
    },
    Select: {
      baseStyle: {
        borderColor: 'cyan.600',
        fontColor: 'red.500',
      },
    },
    SelectItem: {
      baseStyle: {
        color: 'lime',
      },
    },
  };

  const theme = extendTheme({ components });

  const style = color === '0' ? 'dark' : 'light';
  const backgroundColor = color === '0' ? 'transparent' : 'black';

  NavigationBar.setButtonStyleAsync(style);
  NavigationBar.setBackgroundColorAsync(backgroundColor);
  NavigationBar.setBorderColorAsync(backgroundColor);

  return (
    <NativeBaseProvider theme={theme}>
      <StatusBar style={style} backgroundColor={backgroundColor} />
      <SafeAreaProvider>
        <NavigationContainer>
          <StackNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </NativeBaseProvider>
  );
};
