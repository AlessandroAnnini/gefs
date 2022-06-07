import React from 'react';

import { Select } from 'native-base';

import shallow from 'zustand/shallow';

import { graphs } from '../constants';
import { useSettingsStore } from './../stores';

export const GraphSelect: React.FC = () => {
  const { graph, changeGraph } = useSettingsStore(
    (state: SettingsState) => ({
      graph: state.graph,
      changeGraph: state.changeGraph,
    }),
    shallow
  );

  return (
    <Select
      selectedValue={graph}
      minWidth="140"
      accessibilityLabel="Choose Service"
      placeholder="Choose Service"
      _selectedItem={{
        bg: 'teal.600',
        // endIcon: <CheckIcon size="5" />,
      }}
      mt={1}
      onValueChange={changeGraph}
    >
      {graphs.map((graph) => (
        <Select.Item
          key={graph.value}
          label={graph.label}
          value={graph.value}
        />
      ))}
    </Select>
  );
};
