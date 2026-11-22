import { Platform, Text } from 'react-native';

// A route of `app/` is layer 4 too.
export default function Home() {
  return <Text>{Platform.OS}</Text>;
}
