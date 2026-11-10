import type { Board } from '../../engine/board';
import type { BoardState } from '../../engine/board-state';
import type { CoordKey } from '../../engine/coord-key';
import type { IPieceSource } from '../../engine/piece-source';
import type { IMergeable } from './mergeable';
import type { NewTile } from './new-tile';
import type { Slide } from './slide';

// The data that the Merge screen draws: whether the target tile exists.
export interface MergeView {
  readonly targetReached: boolean;
}

// The state of one Hexa Merge game. It narrows `board` to the board of its topology.
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// It changes only through its own methods. `addNewTile()` and `addPoints()` change it in place.
// `slide()` gives the state after the slide and leaves this state unchanged, as the Fit moves do.
// So `targetReached` and `merged` stay read-only. The rules decide when to call each method.
// A refused input throws a RangeError and leaves the whole state as it was.
// `tiles` is the source of the new tiles. It lives in the state (classes.md decision 31),
// so `clone()` clones it, and the rollback of `GameEngine.play()` covers each draw.
// `targetReached` turns true when a merge makes the target tile, and it stays true:
// the target is an event, not the end of the game (A3).
// `merged` holds the tiles that the last move made, one per merge. The gain of the move
// is the sum of their values (§1.4), because a merge does not change the board total.
// The Merge scoring (issue #97) reads it.
// A cell is a value, so `clone()` shares the cell objects and copies the list.
// The bound `IMergeable` lets the state merge two tiles (§3.1, decision 8).
// The constructor checks that the score is a finite number.
export class MergeState<
  TCell extends IMergeable<TCell>,
  TCoord,
  TAxis extends string,
> implements BoardState<TCell, TCoord> {
  constructor(
    readonly board: Board<TCell, TCoord, TAxis>,
    readonly tiles: IPieceSource<NewTile<TCell>>,
    readonly targetReached = false,
    readonly merged: readonly TCell[] = [],
    public score = 0,
  ) {
    if (!Number.isFinite(score)) {
      throw new RangeError(`The score of a state must be a finite number, not ${score}.`);
    }
  }

  // Puts the next tile of the source on an empty cell that the same draw picks.
  // A board with no empty cell, or a source that has ended, gets no new tile.
  // The rules call it after each slide, and `MergeFactory` calls it for the first tiles.
  addNewTile(): void {
    const empty = this.board.shape.cells.filter((c) => this.board.get(c) === undefined);
    if (empty.length === 0 || !this.tiles.hasNext()) return;
    const { place, tile } = this.tiles.next();
    this.board.occupy(empty[Math.floor(place * empty.length)] as TCoord, tile);
  }

  // True when the slide changes at least one cell of the board.
  canSlide(slide: Slide<TAxis>): boolean {
    return this.planOf(slide) !== undefined;
  }

  // The state after the slide. Its board is a copy of this board with the tiles packed
  // toward the leading edge of each line. It keeps the tile source and the score.
  // A merge that makes `target` sets `targetReached`.
  // A slide that changes no cell, or a slide on an axis of another topology, throws a RangeError.
  slide(slide: Slide<TAxis>, target: TCell): MergeState<TCell, TCoord, TAxis> {
    const plan = this.planOf(slide);
    if (plan === undefined) throw new RangeError('The slide changes no cell of the board.');
    const board = this.board.clone();
    for (const [c] of this.board.cells()) board.vacate(c);
    for (const [c, cell] of plan.cells) board.occupy(c, cell);
    return new MergeState(
      board,
      this.tiles,
      this.targetReached || plan.merged.some((tile) => tile.canMergeWith(target)),
      plan.merged,
      this.score,
    );
  }

  addPoints(points: number): void {
    if (!Number.isFinite(points)) {
      throw new RangeError(`The points of a turn must be a finite number, not ${points}.`);
    }
    this.score += points;
  }

  view(): MergeView {
    return Object.freeze({ targetReached: this.targetReached });
  }

  clone(): MergeState<TCell, TCoord, TAxis> {
    return new MergeState(
      this.board.clone(),
      this.tiles.clone(),
      this.targetReached,
      [...this.merged],
      this.score,
    );
  }

  // The cells after the slide, line by line, and the tiles that the merges make.
  // It returns `undefined` when the slide changes no cell. It checks the axis at runtime,
  // because a cast passes the compiler.
  // The proposal on issue #57, «Propuesta, pendiente del equipo», fixes the packing:
  // a slide reads each line from its leading edge, and a tile merges at most once per move.
  private planOf(slide: Slide<TAxis>): { cells: [TCoord, TCell][]; merged: TCell[] } | undefined {
    const { board } = this;
    if (!board.topology.axes().includes(slide.axis)) return undefined;
    const cells: [TCoord, TCell][] = [];
    const merged: TCell[] = [];
    let changed = false;
    for (const line of linesOf(board, slide.axis)) {
      // The leading edge comes first.
      const ordered = slide.toward === 'forward' ? [...line].reverse() : line;
      const packed = pack(
        ordered.flatMap((c) => tileAt(board, c)),
        merged,
      );
      ordered.forEach((c, i) => {
        const cell = packed[i];
        if (cell !== undefined) cells.push([c, cell]);
        if (!isSameCell(board.get(c), cell)) changed = true;
      });
    }
    return changed ? { cells, merged } : undefined;
  }
}

// Two cells are the same when both are empty, or when their tiles are equal.
// The bound has no `equals`. `canMergeWith()` is true exactly for two equal tiles (§1.4).
function isSameCell<TCell extends IMergeable<TCell>>(
  left: TCell | undefined,
  right: TCell | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.canMergeWith(right);
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
