// The complete Sort example of the shared level format (hexablock-api `docs/level-format.md`).
// The format document names its examples as the fixtures of the level tests of both repositories.
// The bundled level `sort-01` holds the same data. It exists only in test/.
// Each call gives a new object, so a test can break one part and keep the others.
export function sortLevelFile() {
  return {
    gameId: 'hexa-sort',
    levelId: 'sort-01',
    order: 1,
    version: 1,
    topology: 'hex',
    section: {
      radius: 2,
      goals: 3,
      source: { seed: 20261115, colors: ['red', 'green', 'blue'] },
      stars: [{ maxMoves: 40 }, { maxMoves: 30 }, { maxMoves: 20 }],
    },
  };
}

// The fixed source of the same document: it writes the stacks in place of the seed and the colors.
// Each stack lists its tiles from the bottom tile to the top tile.
export function sortFixedSource() {
  return {
    stacks: [['red', 'red', 'blue'], ['green'], ['blue', 'green']],
  };
}
