import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_LANGUAGE, textCatalog } from '../src/adapters/texts/text-catalog';

// Every visible text comes from the text catalog (APP-FR-11, issue #154).
const texts = textCatalog[DEFAULT_LANGUAGE];

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{texts['home.title']}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
  },
});
