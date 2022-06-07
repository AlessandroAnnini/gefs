import React from 'react';
import { StyleSheet } from 'react-native';

import { CheckIcon, Select } from 'native-base';

import shallow from 'zustand/shallow';

import { scales } from '../constants';
import { useSettingsStore } from '../stores';

export const ScaleSelect: React.FC = () => {
  const { scale, changeScale } = useSettingsStore(
    (state: SettingsState) => ({
      scale: state.scale,
      changeScale: state.changeScale,
    }),
    shallow
  );

  return (
    <Select
      style={styles.select}
      selectedValue={scale}
      minWidth="100"
      accessibilityLabel="Choose scale"
      placeholder="Choose scale"
      _selectedItem={{
        bg: 'cyan.400',
        endIcon: <CheckIcon size="5" />,
      }}
      mt={1}
      onValueChange={changeScale}
    >
      {scales.map((s) => (
        <Select.Item key={s.value} label={s.label} value={s.value} />
      ))}
    </Select>
  );
};

const styles = StyleSheet.create({
  select: { height: 43, color: '#0891b2', fontSize: 16 },
});
