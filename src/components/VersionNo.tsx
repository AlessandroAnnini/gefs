import { StyleSheet } from 'react-native';

import { Center, Text } from 'native-base';

import { version } from './../../package.json';

export const VersionNo: React.FC = () => {
  return (
    <Center width="100%" style={styles.container}>
      <Text style={styles.text} fontSize="sm">
        {version}
      </Text>
    </Center>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    zIndex: -1,
    paddingBottom: 8,
    opacity: 0.7,
  },
  text: {
    opacity: 0.5,
  },
});
