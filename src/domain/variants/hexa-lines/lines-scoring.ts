import type { Resolution } from '../../engine/resolution';
import type { IScoringPolicy } from '../../engine/scoring-policy';
import type { LinesState } from './lines-state';

// The values code against the proposal on issue 59, «Propuesta, pendiente del equipo
// (cola nocturna, 2026-11-06)». The team has not decided them yet.
// Statement §1.1: «celdas colocadas + bonificación por línea + multiplicador por combo y racha».
export const POINTS_PER_CELL = 1;
export const POINTS_PER_LINE = 10;

// Strategy (D1): the base scoring of Hexa Lines (issue 97). It gives the points of the placed
// cells and the line bonus, with no multiplier. `ComboMultiplierDecorator` adds the multiplier.
// It reads the turn facts from the state, so it keeps no game data (classes.md decision 26).
export class LinesScoring<TCoord> implements IScoringPolicy<LinesState<TCoord>> {
  score(_before: LinesState<TCoord>, resolution: Resolution<LinesState<TCoord>>): number {
    const { state } = resolution;
    return state.cellsPlaced * POINTS_PER_CELL + this.lineBonus(state);
  }

  // The points of the lines that the last placement cleared, before any multiplier.
  lineBonus(state: LinesState<TCoord>): number {
    return state.linesCleared * POINTS_PER_LINE;
  }
}
