import React from 'react';

import { IconButton } from 'native-base';

interface ButtonIconProps {
  onPress: () => void;
  value?: boolean;
  icon?: React.ReactElement;
  icons?: [React.ReactElement, React.ReactElement];
}

export const ButtonIcon: React.FC<ButtonIconProps> = ({
  onPress,
  value,
  icon,
  icons,
}) => {
  return (
    <IconButton
      style={{ width: 43, height: 45 }}
      onPress={onPress}
      variant="outline"
      icon={icon ? icon : icons ? icons[value ? 0 : 1] : undefined}
    />
  );
};
