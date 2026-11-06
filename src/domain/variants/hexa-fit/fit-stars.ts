// The two thresholds of one Fit star (statement §1.2, D20): a move count and a time.
// The level file holds them, and `FitLevelBuilder` reads them (classes.md decision 36).
export interface FitStarThreshold {
  readonly maxMoves: number;
  readonly maxElapsedMs: number;
}

// The moves and the elapsed time of one won Fit level.
// Whether undo and remove count as moves is issue #60: the caller counts the moves.
export interface FitPlay {
  readonly moves: number;
  readonly elapsedMs: number;
}

// The stars of a won Fit level. Proposal of issue #59, «Propuesta, pendiente del equipo»
// (2026-11-06): a star needs both of its thresholds, the moves and the time.
// Each star counts on its own, so the level orders its thresholds as it wants.
export function fitStars(play: FitPlay, thresholds: readonly FitStarThreshold[]): number {
  return thresholds.filter((t) => play.moves <= t.maxMoves && play.elapsedMs <= t.maxElapsedMs)
    .length;
}
