// Wrong example for test/gates/engine-game-id-gate.test.ts: the variant id has no `hexa-` prefix,
// but the condition reads `gameId`.
export function stars(gameId: { value: string }): number {
  if (gameId.value === 'tetra-blocks') return 3;
  return 0;
}
