import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Main, Map } from './screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const customStyleOptions = {
  title: '',
  headerShown: false,
};

export const StackNavigator = () => (
  <Stack.Navigator screenOptions={customStyleOptions}>
    <Stack.Screen name="Main" component={Main} />

    <Stack.Screen name="Map" component={Map} options={{ headerShown: true }} />
  </Stack.Navigator>
);
