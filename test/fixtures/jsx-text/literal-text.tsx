// Wrong examples for test/gates/jsx-text-gate.test.ts: literal texts in JSX.
import { Text, View } from 'react-native';

export function LiteralScreen({ score }: { score: number }) {
  return (
    <View>
      <Text>Hola</Text>
      <Text>
        Adiós
      </Text>
      <Text>{'Jugar'}</Text>
      <Text>{`Salir`}</Text>
      <Text>{`Puntos: ${score}`}</Text>
      <>Fin</>
    </View>
  );
}
