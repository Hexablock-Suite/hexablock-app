import type { Board } from '../../engine/board';
import type { BoardState } from '../../engine/board-state';
import type { MatchId } from '../../engine/match-id';
import type { Piece } from '../../engine/piece';
import type { IPieceSource } from '../../engine/piece-source';
import type { PieceId } from './piece-id';
import type { Placement } from './placement';

// The data that the Fit screen draws: the tray and the pieces on the figure.
export interface FitView<TCoord> {
  readonly remaining: readonly Piece<PieceId, TCoord>[];
  readonly placed: readonly PieceId[];
}

// The state of one Hexa Fit game: the figure board, the pieces of the level,
// and the placement of each piece on the figure.
// The board is the figure: its shape holds only the figure cells (REQUIREMENTS.md §1).
// The pieces come from the level's `FixedListPieceSource`. The state reads it once at start,
// because the player picks the tray pieces in any order.
// The maps use the text of the piece id as key, because a Map compares a string by value.
// `moves` counts the accepted moves of the game for the stars (issue #60).
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is the `MatchId` of its game. Each new state of a move keeps it.
// `place()`, `remove()` and `countMove()` change nothing in place: each one returns a new state.
// `addPoints()` adds the points of a turn in place, because the engine calls it on its copy.
export class FitState<TCoord> implements BoardState<PieceId, TCoord> {
  private constructor(
    private readonly matchId: MatchId,
    readonly board: Board<PieceId, TCoord, string>,
    private readonly pieces: ReadonlyMap<string, Piece<PieceId, TCoord>>,
    private readonly placements: ReadonlyMap<string, Placement<TCoord>>,
    readonly moves = 0,
    public score = 0,
  ) {}

  // Two pieces with the same id throw a RangeError, because a move names its piece by id.
  static start<TCoord>(
    matchId: MatchId,
    figure: Board<PieceId, TCoord, string>,
    source: IPieceSource<Piece<PieceId, TCoord>>,
  ): FitState<TCoord> {
    const pieces = new Map<string, Piece<PieceId, TCoord>>();
    for (const piece of source) {
      if (pieces.has(piece.content.value)) {
        throw new RangeError(`The level has two pieces with the id ${piece.content.value}.`);
      }
      pieces.set(piece.content.value, piece);
    }
    return new FitState(matchId, figure.clone(), pieces, new Map());
  }

  piece(id: PieceId): Piece<PieceId, TCoord> | undefined {
    return this.pieces.get(id.value);
  }

  placementOf(id: PieceId): Placement<TCoord> | undefined {
    return this.placements.get(id.value);
  }

  // The tray: the pieces that are not on the figure, in the order of the source.
  remaining(): Piece<PieceId, TCoord>[] {
    return [...this.pieces.values()].filter((p) => !this.placements.has(p.content.value));
  }

  // The placed pieces, in the order of the source.
  placed(): PieceId[] {
    return [...this.pieces.values()]
      .map((p) => p.content)
      .filter((id) => this.placements.has(id.value));
  }

  // Puts the piece on the cells of `placement`. The rules check the move before.
  place(id: PieceId, placement: Placement<TCoord>): FitState<TCoord> {
    const piece = this.pieces.get(id.value);
    if (piece === undefined) throw new RangeError(`The level has no piece ${id.value}.`);
    const board = this.board.clone();
    for (const c of placement.cells(piece, board.topology)) board.occupy(c, id);
    const placements = new Map(this.placements).set(id.value, placement);
    return new FitState(this.matchId, board, this.pieces, placements, this.moves, this.score);
  }

  // Takes the piece off the figure: a copy of the board vacates each cell of the piece.
  remove(id: PieceId): FitState<TCoord> {
    const board = this.board.clone();
    for (const [c, cell] of this.board.cells()) {
      if (cell.equals(id)) board.vacate(c);
    }
    const placements = new Map(this.placements);
    placements.delete(id.value);
    return new FitState(this.matchId, board, this.pieces, placements, this.moves, this.score);
  }

  // The same state with one more move. The rules call it once for each accepted move.
  countMove(): FitState<TCoord> {
    return new FitState(
      this.matchId,
      this.board,
      this.pieces,
      this.placements,
      this.moves + 1,
      this.score,
    );
  }

  // The engine adds the points of a turn in place. Points that are not finite throw a RangeError.
  addPoints(points: number): void {
    if (!Number.isFinite(points)) {
      throw new RangeError(`The points of a turn must be a finite number, not ${points}.`);
    }
    this.score += points;
  }

  // True when this state is the state of the match `match`.
  belongsTo(match: MatchId): boolean {
    return this.matchId.equals(match);
  }

  // Two states are the same state when they belong to the same match.
  // Their boards, their scores and their other values do not count.
  equals(other: BoardState<PieceId, TCoord>): boolean {
    return other.belongsTo(this.matchId);
  }

  // A piece and an id never change, so the view shares them. `remaining()` and `placed()`
  // build new lists, and the view freezes them.
  view(): FitView<TCoord> {
    return Object.freeze({
      remaining: Object.freeze(this.remaining()),
      placed: Object.freeze(this.placed()),
    });
  }

  // A piece never changes, so the clone shares the pieces and the placements.
  // The clone keeps the move count, so undo gives back the count before the move.
  clone(): FitState<TCoord> {
    return new FitState(
      this.matchId,
      this.board.clone(),
      this.pieces,
      this.placements,
      this.moves,
      this.score,
    );
  }
}
