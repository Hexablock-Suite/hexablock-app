import type { GridAxis } from '../../engine/grid-topology';
import { Outcome } from '../../engine/outcome';
import { Resolution } from '../../engine/resolution';
import { BaseGameRules } from '../../engine/rules';
import type { IMergeable } from './mergeable';
import type { MergeState } from './merge-state';
import { SLIDE_SENSES, Slide } from './slide';

// Strategy (D1): the rules of Hexa Merge (statement §1.4). It extends `BaseGameRules`,
// so the engine runs the turn through the template method `playTurn()` (decision 21).
// Bounded generic (§3.1, decision 8): a cell only needs to merge with an equal cell.
// The rules code against the proposal on issue #57, «Propuesta, pendiente del equipo»
// (overnight queue, 2026-11-06). The team has not decided it yet:
// - A slide reads each line from its leading edge, the edge that the tiles move toward.
// - A tile merges at most once per move. So `2 2 2` gives `4 2`, and `4 2 2` gives `4 4`.
// A slide that changes no cell is not valid. The game ends when no slide changes the board
// after the new tile appears.
// The target tile sets `targetReached` and does not end the game (A3).
// The rules decide. The state changes itself in place: `MergeState.slide()` packs the tiles,
// and `MergeState.addNewTile()` puts the new tile. The rules read the axes through the photo
// of the state and ask `canSlide()`.
export class MergeRules<
  TCell extends IMergeable<TCell>,
  TCoord,
  TAxis extends GridAxis,
> extends BaseGameRules<Slide<TAxis>, MergeState<TCell, TCoord, TAxis>> {
  // The rules compare a tile with the target by `canMergeWith()`: two tiles merge
  // exactly when they are equal (§1.4).
  constructor(private readonly target: TCell) {
    super();
  }

  isValid(state: MergeState<TCell, TCoord, TAxis>, slide: Slide<TAxis>): boolean {
    return state.canSlide(slide);
  }

  *validMoves(state: MergeState<TCell, TCoord, TAxis>): Iterable<Slide<TAxis>> {
    for (const axis of state.snapshot().board.topology.axes()) {
      for (const toward of SLIDE_SENSES) {
        const slide = Slide.of(axis, toward);
        if (this.isValid(state, slide)) yield slide;
      }
    }
  }

  apply(
    state: MergeState<TCell, TCoord, TAxis>,
    slide: Slide<TAxis>,
  ): MergeState<TCell, TCoord, TAxis> {
    state.slide(slide, this.target);
    return state;
  }

  // A new tile appears on an empty cell after each accepted slide (§1.4, issue #95).
  // It comes from the source in the state (classes.md decision 31), so the cell and the
  // value both come from one seeded source (APP-NFR-07). The proposal on issue #57,
  // «Propuesta, pendiente del equipo», fixes the rest: a 2 with 0.9 and a 4 with 0.1
  // (`mergeTileSource()`), and undo restores the cloned state, so the same tile comes back.
  // A board with no empty cell, or a source that has ended, gets no new tile.
  resolve(state: MergeState<TCell, TCoord, TAxis>): Resolution {
    state.addNewTile();
    return Resolution.resolved();
  }

  evaluate(state: MergeState<TCell, TCoord, TAxis>): Outcome {
    return this.noValidMove(state) ? Outcome.gameOver : Outcome.playing;
  }
}
