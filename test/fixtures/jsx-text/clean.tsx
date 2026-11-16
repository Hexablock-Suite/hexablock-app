// Right example for test/gates/jsx-text-gate.test.ts: every text comes from a value.
// White space between tags and a string attribute are not visible texts of this gate.
import { Text, View } from 'react-native';

export function CatalogScreen({ title, score }: { title: string; score: number }) {
  return (
    <View testID="catalog-screen">
      <Text>{title}</Text>
      <Text>
        {title}{' '}{score}
      </Text>
      <Text>{`${title} ${score}`}</Text>
    </View>
  );
}
