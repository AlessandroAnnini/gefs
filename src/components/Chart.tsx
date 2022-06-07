import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Heading, View } from 'native-base';

import Gallery, { Image } from 'react-native-image-gallery';

interface ChartProps {
  images: Image[];
  captions: string[];
}

export const Chart: React.FC<ChartProps> = ({ images, captions }) => {
  const [index, setIndex] = useState(0);

  return (
    <View style={styles.container}>
      <Heading size="md" style={styles.chartName}>
        {captions[index]}
      </Heading>
      <Gallery
        style={{ flex: 1, padding: 4 }}
        images={images}
        onPageSelected={setIndex}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  chartName: { color: '#0891b2' },
});
