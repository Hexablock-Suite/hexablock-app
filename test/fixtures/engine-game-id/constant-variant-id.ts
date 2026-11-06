// Wrong example for test/gates/engine-game-id-gate.test.ts: constants hold the game id,
// and the conditions read the constants.
const LINES = 'hexa-lines';

export function bonus(kind: string, engine: { gameId: { value: string } }): number {
  const id = engine.gameId.value;
  if (kind === LINES) return 10;
  return id === 'x' ? 1 : 0;
}
