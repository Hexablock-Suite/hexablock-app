// Wrong examples for test/gates/jsx-text-gate.test.ts: literal texts in the text props.
import { Text, TextInput, View } from 'react-native';

function Badge(props: { readonly label: string; readonly title?: string; readonly look?: string }) {
  return <Text>{props.label}</Text>;
}

export function LiteralProps({ name, level }: { name: string; level: number }) {
  // `testID`, `look` and a white-space template are not visible texts.
  const blank = ' ';
  return (
    <View testID="literal-props">
      {blank}
      <Text>{name}</Text>
      <Badge label="Jugar" look="panel" />
      <Badge label={name} title={'Pausa'} />
      <View accessibilityLabel={`Tablero`} />
      <View accessibilityHint="Toca una celda" />
      <TextInput placeholder={`Nivel ${level}`} />
      <Badge label={` ${name} `} />
    </View>
  );
}
