// The baseline lists of the two domain gates (issue #231).
// Each entry is a break that the code of `src/domain/` has today.
// Each entry names the open issue that removes it.
// A gate fails when the code has a break with no entry.
// A gate also fails when an entry names a break that the code no longer has.
// So each list only shrinks: the pull request that closes an issue deletes its entries.

// A primitive in a public signature: `test/docs/primitive-types.test.ts` (APP-NFR-25).
export type PrimitiveEntry = { primitive: 'number' | 'string'; where: string; issue: number };

// A field that is not private, or a getter: `test/docs/domain-private-fields.test.ts`
// (rule R-domain-private-fields).
export type FieldEntry = { rule: 'field' | 'get'; where: string; issue: number };

export const primitiveBaseline: readonly PrimitiveEntry[] = [
  // #232: the primitives of the variants and `Score.times()`.
  { primitive: 'number', where: 'Score.times', issue: 232 },
  { primitive: 'number', where: 'LinesSnapshot.streak', issue: 232 },
  { primitive: 'number', where: 'LinesSnapshot.linesCleared', issue: 232 },
  { primitive: 'number', where: 'LinesSnapshot.cellsPlaced', issue: 232 },
  { primitive: 'number', where: 'PlacePiece.constructor', issue: 232 },
  { primitive: 'number', where: 'Chance.hits', issue: 232 },
  { primitive: 'number', where: 'ColorStack.tileCount', issue: 232 },
  { primitive: 'number', where: 'SortSnapshot.clearedTiles', issue: 232 },
  // #237: `toString()` leaves 13 classes.
  { primitive: 'string', where: 'TopologyId.toString', issue: 237 },
  { primitive: 'string', where: 'Outcome.toString', issue: 237 },
  { primitive: 'string', where: 'HexCoord.toString', issue: 237 },
  { primitive: 'string', where: 'HexAxis.toString', issue: 237 },
  { primitive: 'string', where: 'HexDirection.toString', issue: 237 },
  { primitive: 'string', where: 'SquareCoord.toString', issue: 237 },
  { primitive: 'string', where: 'SquareAxis.toString', issue: 237 },
  { primitive: 'string', where: 'SquareDirection.toString', issue: 237 },
  { primitive: 'string', where: 'TriangleCoord.toString', issue: 237 },
  { primitive: 'string', where: 'TriangleAxis.toString', issue: 237 },
  { primitive: 'string', where: 'TriangleDirection.toString', issue: 237 },
  { primitive: 'string', where: 'PieceId.toString', issue: 237 },
  { primitive: 'string', where: 'SlideSense.toString', issue: 237 },
  // #238: the clock reading.
  { primitive: 'number', where: 'Clock.now', issue: 238 },
  // #239: `Range` orders its values without a number.
  { primitive: 'number', where: 'Compare', issue: 239 },
  { primitive: 'number', where: 'Range.ofNumbers', issue: 239 },
  // #243: the engine primitives that keep a README reason.
  { primitive: 'number', where: 'RandomSource.next', issue: 243 },
  { primitive: 'number', where: 'Mulberry32Random.next', issue: 243 },
  { primitive: 'number', where: 'Seed.generatorState', issue: 243 },
  { primitive: 'number', where: 'ShapeNode.area', issue: 243 },
  { primitive: 'number', where: 'CellNode.area', issue: 243 },
  { primitive: 'number', where: 'ShapeGroup.area', issue: 243 },
  { primitive: 'number', where: 'HexCoord.distanceTo', issue: 243 },
  { primitive: 'number', where: 'Radius.offsets', issue: 243 },
  { primitive: 'number', where: 'Radius.measures', issue: 243 },
  { primitive: 'number', where: 'RegionSize.indexes', issue: 243 },
  { primitive: 'number', where: 'RegionSize.offsets', issue: 243 },
  { primitive: 'number', where: 'RegionSize.holds', issue: 243 },
  { primitive: 'number', where: 'MoveHistory.constructor', issue: 243 },
  // #246: the team decides whether a branded key counts as a primitive.
  { primitive: 'string', where: 'CoordKey', issue: 246 },
  { primitive: 'string', where: 'coordKey', issue: 246 },
  // #232: the exported number constants of the variants, and the three counts
  // that the `LinesState` constructor takes. #232 covers the primitives of the variants.
  { primitive: 'number', where: 'FIT_POINTS_PER_TURN', issue: 232 },
  { primitive: 'number', where: 'POINTS_PER_CELL', issue: 232 },
  { primitive: 'number', where: 'POINTS_PER_LINE', issue: 232 },
  { primitive: 'number', where: 'TRAY_SIZE', issue: 232 },
  { primitive: 'number', where: 'START_TILES', issue: 232 },
  { primitive: 'number', where: 'MERGE_UNDO_LIMIT', issue: 232 },
  { primitive: 'number', where: 'GOAL_RUN', issue: 232 },
  { primitive: 'number', where: 'SORT_POINTS_PER_TILE', issue: 232 },
  { primitive: 'number', where: 'LinesState.constructor', issue: 232 },
];
