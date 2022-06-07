import { StyleSheet } from 'react-native';

import { Center, Text } from 'native-base';

interface CoordinatesProps {
  latitude: number;
  longitude: number;
  isPortrait: boolean;
}

export const Coordinates: React.FC<CoordinatesProps> = ({
  latitude,
  longitude,
  isPortrait,
}) =>
  isPortrait ? (
    <Center width="100%" style={styles.container}>
      <Text fontSize="md">{`@ ${latitude}, ${longitude}`}</Text>
    </Center>
  ) : null;

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
    opacity: 0.7,
  },
});
