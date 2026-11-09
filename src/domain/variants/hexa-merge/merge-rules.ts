import { Board } from '../../engine/board';
import type { CoordKey } from '../../engine/coord-key';
import type { Outcome } from '../../engine/outcome';
import { Resolution } from '../../engine/resolution';
import { BaseGameRules } from '../../engine/rules';
import type { IMergeable } from './mergeable';
import { MergeState } from './merge-state';
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
export class MergeRules<
  TCell extends IMergeable<TCell>,
  TCoord,
  TAxis extends string,
> extends BaseGameRules<Slide<TAxis>, MergeState<TCell, TCoord, TAxis>> {
  // The rules compare a tile with the target by `canMergeWith()`: two tiles merge
  // exactly when they are equal (§1.4).
  constructor(private readonly target: TCell) {
    super();
  }

  isValid(state: MergeState<TCell, TCoord, TAxis>, slide: Slide<TAxis>): boolean {
    return this.slid(state, slide) !== undefined;
  }

  *validMoves(state: MergeState<TCell, TCoord, TAxis>): Iterable<Slide<TAxis>> {
    for (const axis of state.board.topology.axes()) {
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
    const next = this.slid(state, slide);
    if (next === undefined) throw new RangeError('The slide changes no cell of the board.');
    return next;
  }

  // A new tile appears on an empty cell after each accepted slide (§1.4, issue #95).
  // It comes from the source in the state (classes.md decision 31), so the cell and the
  // value both come from one seeded source (APP-NFR-07). The proposal on issue #57,
  // «Propuesta, pendiente del equipo», fixes the rest: a 2 with 0.9 and a 4 with 0.1
  // (`mergeTileSource()`), and undo restores the cloned state, so the same tile comes back.
  // A board with no empty cell, or a source that has ended, gets no new tile.
  resolve(state: MergeState<TCell, TCoord, TAxis>): Resolution<MergeState<TCell, TCoord, TAxis>> {
    addNewTile(state);
    return Resolution.resolved(state);
  }

  evaluate(state: MergeState<TCell, TCoord, TAxis>): Outcome {
    return this.noValidMove(state) ? 'game-over' : 'playing';
  }

  // The state after the slide, or `undefined` when the slide changes no cell.
  // The rules check the axis at runtime, because a cast passes the compiler.
  private slid(
    state: MergeState<TCell, TCoord, TAxis>,
    slide: Slide<TAxis>,
  ): MergeState<TCell, TCoord, TAxis> | undefined {
    const { board } = state;
    if (!board.topology.axes().includes(slide.axis)) return undefined;
    const content = new Map<CoordKey, [TCoord, TCell]>();
    const merged: TCell[] = [];
    let changed = false;
    for (const line of linesOf(board, slide.axis)) {
      // The leading edge comes first.
      const cells = slide.toward === 'forward' ? [...line].reverse() : line;
      const packed = pack(
        cells.flatMap((c) => tileAt(board, c)),
        merged,
      );
      cells.forEach((c, i) => {
        const cell = packed[i];
        if (cell !== undefined) content.set(board.topology.key(c), [c, cell]);
        if (!this.isSameCell(board.get(c), cell)) changed = true;
      });
    }
    if (!changed) return undefined;
    return new MergeState(
      new Board(board.shape, board.topology, content),
      state.tiles,
      state.targetReached || merged.some((tile) => tile.canMergeWith(this.target)),
      merged,
      state.score,
    );
  }

  // Two cells are the same when both are empty, or when their tiles are equal.
  // The bound has no `equals`. `canMergeWith()` is true exactly for two equal tiles (§1.4).
  private isSameCell(left: TCell | undefined, right: TCell | undefined): boolean {
    if (left === undefined || right === undefined) return left === right;
    return left.canMergeWith(right);
  }
}

// Puts the next tile of the source on an empty cell that the same draw picks.
// A board with no empty cell, or a source that has ended, gets no new tile.
// The rules call it after each slide, and `MergeFactory` calls it for the first tiles.
export function addNewTile<TCell, TCoord, TAxis extends string>(
  state: MergeState<TCell, TCoord, TAxis>,
): void {
  const { board, tiles } = state;
  const empty = board.shape.cells.filter((c) => board.get(c) === undefined);
  if (empty.length === 0 || !tiles.hasNext()) return;
  const { place, tile } = tiles.next();
  board.set(empty[Math.floor(place * empty.length)] as TCoord, tile);
}

function tileAt<TCell, TCoord>(board: Board<TCell, TCoord, string>, c: TCoord): TCell[] {
  const cell = board.get(c);
  return cell === undefined ? [] : [cell];
}

// Every line of the board on one axis, each one once, in the order of `Board.line()`.
function linesOf<TCell, TCoord, TAxis extends string>(
  board: Board<TCell, TCoord, TAxis>,
  axis: TAxis,
): TCoord[][] {
  const covered = new Set<CoordKey>();
  const lines: TCoord[][] = [];
  for (const c of board.shape.cells) {
    if (covered.has(board.topology.key(c))) continue;
    const line = [...board.line(axis, c)];
    for (const on of line) covered.add(board.topology.key(on));
    lines.push(line);
  }
  return lines;
}

// Packs the tiles of one line toward its leading edge, the first tile first.
// Two equal neighbors merge once, and the merged tile does not merge again in this move.
// It adds each merged tile to `merged`.
function pack<TCell extends IMergeable<TCell>>(tiles: readonly TCell[], merged: TCell[]): TCell[] {
  const packed: TCell[] = [];
  for (let i = 0; i < tiles.length; i += 1) {
    const tile = tiles[i] as TCell;
    const behind = tiles[i + 1];
    if (behind !== undefined && tile.canMergeWith(behind)) {
      const made = tile.mergeWith(behind);
      merged.push(made);
      packed.push(made);
      i += 1;
    } else {
      packed.push(tile);
    }
  }
  return packed;
}
