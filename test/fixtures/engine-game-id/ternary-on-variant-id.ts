// Wrong example for test/gates/engine-game-id-gate.test.ts: a ternary that compares `.id`
// to a variant id string.
export function trayOf(game: { id: string }): number {
  return game.id === 'hexa-merge' ? 0 : 3;
}
