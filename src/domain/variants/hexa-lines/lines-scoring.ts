import type { Score } from '../../shared/score';
import type { IScoringPolicy } from '../../engine/turn/scoring-policy';
import type { LinesSnapshot, LinesState } from './lines-state';

// Strategy (D1): the base scoring of Hexa Lines (issue 97). It gives the points of the placed
// cells and the line bonus, with no multiplier. `ComboMultiplierDecorator` adds the multiplier.
// Statement §1.1: «celdas colocadas + bonificación por línea + multiplicador por combo y racha».
// The values code the accepted rule of issue #59 (D22, 2026-11-06): `CellCount` gives
// `POINTS_PER_CELL` for each placed cell, and `LineCount` gives `POINTS_PER_LINE` for each line.
// The counts keep their numbers private (issue #232), so each count gives its own points.
// It asks the photo after the turn for the turn facts, so it keeps no game data
// (classes.md decision 26). It gives the points and the line bonus as `Score` values (decision 41).
export class LinesScoring<TCoord> implements IScoringPolicy<LinesState<TCoord>> {
  score(_before: LinesSnapshot<TCoord>, after: LinesSnapshot<TCoord>): Score {
    return after.lastPlacedCells().points().add(this.lineBonus(after));
  }

  // The points of the lines that the last placement cleared, before any multiplier.
  // Only `score()` reads it, so it is private (issue #427).
  private lineBonus(after: LinesSnapshot<TCoord>): Score {
    return after.lastCombo().bonus();
  }
}
