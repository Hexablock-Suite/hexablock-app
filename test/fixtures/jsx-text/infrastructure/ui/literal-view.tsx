// Wrong example for test/gates/jsx-text-gate.test.ts: a shared view of `src/infrastructure/`
// with a literal text and a literal label, as a result screen could have.
import { Text, View } from 'react-native';

function Button(props: { readonly label: string }) {
  return <Text>{props.label}</Text>;
}

export function ResultView({ score }: { score: string }) {
  return (
    <View>
      <Text>Victoria</Text>
      <Button label="Otra vez" />
      <Text>{score}</Text>
    </View>
  );
}
