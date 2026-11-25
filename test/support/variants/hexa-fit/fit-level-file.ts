// A square Fit level in the shared level format: a figure of 2 x 2 squares and two dominoes.
// The witness turns the second domino by a half turn (issue #168, S3-08 in #151).
// This level exists only in test/. It is not the bundled level `fit-square-01` of #354:
// a test gives it to the repository in place of the bundled files.
// Its order is 2, so the list of a square figure shows a first level that is not level 1.
export function squareFitLevelFile() {
  return {
    gameId: 'hexa-fit',
    levelId: 'fit-square-01',
    order: 2,
    version: 1,
    topology: 'square',
    section: {
      figure: [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ],
      pieces: [
        {
          id: 'a',
          cells: [
            [0, 0],
            [1, 0],
          ],
        },
        {
          id: 'b',
          cells: [
            [0, 0],
            [1, 0],
          ],
        },
      ],
      witness: [
        { piece: 'a', rotation: 0, at: [0, 0] },
        { piece: 'b', rotation: -2, at: [1, 1] },
      ],
      stars: [{ maxMoves: 2, maxElapsedMs: 1000 }],
    },
  };
}

// The complete Fit example of the shared level format (hexablock-api `docs/level-format.md`).
// The format document names its examples as the fixtures of the level tests of both repositories.
// The bundled level `fit-01` holds the same data. It exists only in test/.
// Each call gives a new object, so a test can break one part and keep the others.
export function fitLevelFile() {
  return {
    gameId: 'hexa-fit',
    levelId: 'fit-01',
    order: 1,
    version: 1,
    topology: 'hex',
    section: {
      figure: [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      pieces: [
        {
          id: 'a',
          cells: [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
        },
        {
          id: 'b',
          cells: [
            [0, 0],
            [1, 0],
          ],
        },
        { id: 'c', cells: [[0, 0]] },
      ],
      witness: [
        { piece: 'a', rotation: 0, at: [0, 0] },
        { piece: 'b', rotation: 1, at: [2, 0] },
        { piece: 'c', rotation: 0, at: [1, 1] },
      ],
      stars: [
        { maxMoves: 12, maxElapsedMs: 120000 },
        { maxMoves: 8, maxElapsedMs: 60000 },
        { maxMoves: 4, maxElapsedMs: 30000 },
      ],
    },
  };
}
