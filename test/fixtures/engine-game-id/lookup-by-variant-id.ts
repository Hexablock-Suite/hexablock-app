// Wrong example for test/gates/engine-game-id-gate.test.ts: lookup tables keyed by the game id.
export function bonus(id: { value: string }): number | undefined {
  return { 'hexa-lines': 10, 'hexa-sort': 5 }[id.value];
}

export function limit(gameId: { value: string }, table: Record<string, number>): number | undefined {
  return table[gameId.value];
}
