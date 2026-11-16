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
  // #238: the clock reading.
  { primitive: 'number', where: 'Clock.now', issue: 238 },
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

export const fieldBaseline: readonly FieldEntry[] = [
  // #234: the public read-only members and `Board.get(at)`.
  { rule: 'field', where: 'PieceDraw.piece', issue: 234 },
  { rule: 'field', where: 'PieceDraw.rest', issue: 234 },
  { rule: 'field', where: 'SeededPieceSource.seed', issue: 234 },
  { rule: 'field', where: 'IRandomSeeded.seed', issue: 234 },
  { rule: 'field', where: 'IVariantFactory.gameId', issue: 234 },
  { rule: 'field', where: 'GeometryFactory.id', issue: 234 },
  { rule: 'get', where: 'ReadonlyBoard.get', issue: 234 },
  { rule: 'get', where: 'Board.get', issue: 234 },
  // #245: the five photos and the four `*View` interfaces.
  { rule: 'field', where: 'BoardSnapshot.stateId', issue: 245 },
  { rule: 'field', where: 'BoardSnapshot.matchId', issue: 245 },
  { rule: 'field', where: 'BoardSnapshot.board', issue: 245 },
  { rule: 'field', where: 'BoardSnapshot.score', issue: 245 },
  { rule: 'field', where: 'LinesView.tray', issue: 245 },
  { rule: 'field', where: 'LinesSnapshot.tray', issue: 245 },
  { rule: 'field', where: 'LinesSnapshot.streak', issue: 245 },
  { rule: 'field', where: 'LinesSnapshot.linesCleared', issue: 245 },
  { rule: 'field', where: 'LinesSnapshot.cellsPlaced', issue: 245 },
  { rule: 'field', where: 'LinesSnapshot.source', issue: 245 },
  { rule: 'field', where: 'FitView.remaining', issue: 245 },
  { rule: 'field', where: 'FitView.placed', issue: 245 },
  { rule: 'field', where: 'FitSnapshot.placements', issue: 245 },
  { rule: 'field', where: 'FitSnapshot.moves', issue: 245 },
  { rule: 'field', where: 'SortView.offered', issue: 245 },
  { rule: 'field', where: 'SortView.goalsDone', issue: 245 },
  { rule: 'field', where: 'SortView.goalsNeeded', issue: 245 },
  { rule: 'field', where: 'SortSnapshot.offered', issue: 245 },
  { rule: 'field', where: 'SortSnapshot.goalsDone', issue: 245 },
  { rule: 'field', where: 'SortSnapshot.goalsNeeded', issue: 245 },
  { rule: 'field', where: 'SortSnapshot.clearedTiles', issue: 245 },
  { rule: 'field', where: 'SortSnapshot.placedAt', issue: 245 },
  { rule: 'field', where: 'SortSnapshot.source', issue: 245 },
  { rule: 'field', where: 'MergeView.targetReached', issue: 245 },
  { rule: 'field', where: 'MergeSnapshot.board', issue: 245 },
  { rule: 'field', where: 'MergeSnapshot.targetReached', issue: 245 },
  { rule: 'field', where: 'MergeSnapshot.merged', issue: 245 },
  { rule: 'field', where: 'MergeSnapshot.tiles', issue: 245 },
  // #234: the classes that implement `IVariantFactory.gameId` and `GeometryFactory.id`.
  // #234 turns those two members into queries, so the fields of the classes close with them.
  { rule: 'field', where: 'LinesFactory.gameId', issue: 234 },
  { rule: 'field', where: 'FitFactory.gameId', issue: 234 },
  { rule: 'field', where: 'SortFactory.gameId', issue: 234 },
  { rule: 'field', where: 'MergeFactory.gameId', issue: 234 },
  { rule: 'field', where: 'HexGeometry.id', issue: 234 },
  { rule: 'field', where: 'SquareGeometry.id', issue: 234 },
  { rule: 'field', where: 'TriangleGeometry.id', issue: 234 },
];
