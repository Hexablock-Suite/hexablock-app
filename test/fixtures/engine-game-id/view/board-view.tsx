// Wrong example for test/gates/engine-game-id-gate.test.ts: a `.tsx` file in a subfolder.
export const Title = ({ gameId }: { gameId: { value: string } }) => (
  <Text>{gameId.value === 'hexa-merge' ? 'Merge' : 'Other'}</Text>
);
