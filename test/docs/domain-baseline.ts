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
  // #238: the clock reading.
  { primitive: 'number', where: 'Clock.now', issue: 238 },
  // #246: the team decides whether a branded key counts as a primitive.
  { primitive: 'string', where: 'CoordKey', issue: 246 },
  { primitive: 'string', where: 'coordKey', issue: 246 },
];

export const fieldBaseline: readonly FieldEntry[] = [
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
];
