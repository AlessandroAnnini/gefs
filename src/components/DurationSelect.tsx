import React from 'react';
import { StyleSheet } from 'react-native';

import { Select } from 'native-base';

import shallow from 'zustand/shallow';

import { durations } from '../constants';
import { useSettingsStore } from '../stores';

export const DurationSelect: React.FC = () => {
  const { duration, changeDuration } = useSettingsStore(
    (state: SettingsState) => ({
      duration: state.duration,
      // changeDuration: state.changeDuration,
      // toggleMode: state.toggleMode,
      // toggleColor: state.toggleColor,
      // isLocationFromMap: state.isLocationFromMap,
      // updateTime: state.updateTime,
      // isSearchingCoords: state.isSearchingCoords,
    }),
    shallow
  );

  return (
    <Select
      selectedValue={duration}
      minWidth="100"
      accessibilityLabel="Choose Service"
      placeholder="Choose Service"
      _selectedItem={{
        bg: 'teal.600',
        // endIcon: <CheckIcon size="5" />,
      }}
      mt={1}
      onValueChange={changeDuration}
    >
      {durations.map((duration) => (
        <Select.Item
          key={duration.value}
          label={duration.label}
          value={duration.value}
        />
      ))}
    </Select>
  );
};
