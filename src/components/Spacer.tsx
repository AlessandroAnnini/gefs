import React from 'react';
import { View } from 'react-native';

interface Spacer {
  flexGrow?: number;
  width?: number;
  height?: number;
  style?: any;
}

export const Spacer: React.FC<Spacer> = ({
  flexGrow,
  width,
  height,
  style,
}) => <View style={{ flexGrow, width, height, ...style }} />;
