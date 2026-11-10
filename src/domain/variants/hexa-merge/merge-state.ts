import type { Board, ReadonlyBoard } from '../../engine/board';
import { checkOwnSnapshot, type BoardSnapshot, type BoardState } from '../../engine/board-state';
import type { Cloneable } from '../../engine/cloneable';
import type { CoordKey } from '../../engine/coord-key';
import type { GameStateId } from '../../engine/game-state-id';
import type { MatchId } from '../../engine/match-id';
import { Score } from '../../engine/score';
import type { IPieceSource } from '../../engine/piece-source';
import type { IMergeable } from './mergeable';
import type { NewTile } from './new-tile';
import type { Slide } from './slide';

// The data that the Merge screen draws: whether the target tile exists.
export interface MergeView {
  readonly targetReached: boolean;
}

// The photo of a Merge state (classes.md decision 34): the board of its topology, the score,
// whether the target exists, the tiles of the last merges and a copy of the tile source
// at its position. The source shows only `clone()`, so a reader cannot draw from the photo.
// `view()` gives whether the target exists for the screen.
export interface MergeSnapshot<
  TCell extends IMergeable<TCell>,
  TCoord,
  TAxis extends string,
> extends BoardSnapshot<TCell, TCoord> {
  readonly board: ReadonlyBoard<TCell, TCoord, TAxis>;
  readonly targetReached: boolean;
  readonly merged: readonly TCell[];
  readonly tiles: Cloneable<IPieceSource<NewTile<TCell>>>;
  view(): MergeView;
}

// The state of one Hexa Merge game. It narrows `board` to the board of its topology.
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is its own `GameStateId`, and `equals()` compares only that identity.
// It also keeps the `MatchId` of its game, and `belongsTo()` reads it.
// It changes only through its own methods. The state keeps its object, so `addNewTile()`,
// `slide()`, `addPoints()` and `restore()` change it in place. The rules decide when to call
// each method. The scoring, the rules and the use cases read the photo of `snapshot()`.
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
// The score is a `Score`, which checks its own value.
export class MergeState<
  TCell extends IMergeable<TCell>,
  TCoord,
  TAxis extends string,
> implements BoardState<TCell, TCoord> {
  constructor(
    private readonly stateId: GameStateId,
    private readonly matchId: MatchId,
    private readonly board: Board<TCell, TCoord, TAxis>,
    private tiles: IPieceSource<NewTile<TCell>>,
    private targetReached = false,
    private merged: readonly TCell[] = [],
    private score: Score = Score.of(0),
  ) {}

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

  // Packs the tiles of the board toward the leading edge of each line, in place.
  // The board vacates every tile, then takes the packed tiles line by line.
  // So `cells()` lists the tiles in the order of the packed lines.
  // `merged` takes the tiles that the merges of this slide make.
  // A merge that makes `target` sets `targetReached`. The tile source and the score do not change.
  // A slide that changes no cell, or a slide on an axis of another topology, throws a RangeError
  // before any change.
  slide(slide: Slide<TAxis>, target: TCell): void {
    const plan = this.planOf(slide);
    if (plan === undefined) throw new RangeError('The slide changes no cell of the board.');
    for (const [c] of this.board.cells()) this.board.vacate(c);
    for (const [c, cell] of plan.cells) this.board.occupy(c, cell);
    this.targetReached ||= plan.merged.some((tile) => tile.canMergeWith(target));
    this.merged = plan.merged;
  }

  // The engine adds the points of a turn in place. `Score.add()` refuses a total
  // above the largest safe integer, and the score stays as it was.
  addPoints(points: Score): void {
    this.score = this.score.add(points);
  }

  // True when this state is the state of the match `match`.
  belongsTo(match: MatchId): boolean {
    return this.matchId.equals(match);
  }

  // Two states with one `GameStateId` are the same state.
  // Their matches, their boards, their scores and their other values do not count.
  equals(other: BoardState<TCell, TCoord>): boolean {
    return other instanceof MergeState && this.stateId.equals(other.stateId);
  }

  // The photo of the state now. A tile is a value, so the photo shares the tiles.
  // It holds a frozen list and copies of the board and the tile source.
  snapshot(): MergeSnapshot<TCell, TCoord, TAxis> {
    const view = Object.freeze({ targetReached: this.targetReached });
    return Object.freeze({
      stateId: this.stateId,
      matchId: this.matchId,
      board: this.board.clone(),
      score: this.score,
      targetReached: this.targetReached,
      merged: Object.freeze([...this.merged]),
      tiles: this.tiles.clone(),
      view: () => view,
    });
  }

  // Takes back a photo of this state, in place. A photo of another state or of another board
  // changes nothing.
  restore(snapshot: MergeSnapshot<TCell, TCoord, TAxis>): void {
    checkOwnSnapshot(this.stateId, this.board, snapshot);
    this.board.restore(snapshot.board);
    this.tiles = snapshot.tiles.clone();
    this.targetReached = snapshot.targetReached;
    this.merged = [...snapshot.merged];
    this.score = snapshot.score;
  }

  clone(): MergeState<TCell, TCoord, TAxis> {
    return new MergeState(
      this.stateId,
      this.matchId,
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
