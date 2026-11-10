import { Score } from '../../engine/score';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { LinesSnapshot, LinesState } from './lines-state';

// The values code the accepted rule of issue #59 (D22, 2026-11-06).
// Statement §1.1: «celdas colocadas + bonificación por línea + multiplicador por combo y racha».
export const POINTS_PER_CELL = 1;
export const POINTS_PER_LINE = 10;

// Strategy (D1): the base scoring of Hexa Lines (issue 97). It gives the points of the placed
// cells and the line bonus, with no multiplier. `ComboMultiplierDecorator` adds the multiplier.
// It reads the turn facts from the photo after the turn, so it keeps no game data
// (classes.md decision 26). It gives the points and the line bonus as `Score` values (decision 41).
export class LinesScoring<TCoord> implements IScoringPolicy<LinesState<TCoord>> {
  score(_before: LinesSnapshot<TCoord>, after: LinesSnapshot<TCoord>): Score {
    return Score.of(after.cellsPlaced * POINTS_PER_CELL).add(this.lineBonus(after));
  }

  // The points of the lines that the last placement cleared, before any multiplier.
  lineBonus(after: LinesSnapshot<TCoord>): Score {
    return Score.of(after.linesCleared * POINTS_PER_LINE);
  }
}
