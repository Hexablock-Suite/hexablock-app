import type { Board } from '../../engine/board';
import type { BoardState } from '../../engine/board-state';
import type { GameStateId } from '../../engine/game-state-id';
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
// Its identity is its own `GameStateId`, and `equals()` compares only that identity.
// It also keeps the `MatchId` of its game, and `belongsTo()` reads it.
// The state keeps its object, so every business method changes it in place and returns nothing:
// `place()`, `remove()`, `countMove()` and `addPoints()`. The engine calls them on its copy.
// A refused input throws a RangeError and leaves the whole state as it was.
export class FitState<TCoord> implements BoardState<PieceId, TCoord> {
  private constructor(
    private readonly stateId: GameStateId,
    private readonly matchId: MatchId,
    readonly board: Board<PieceId, TCoord, string>,
    private readonly pieces: ReadonlyMap<string, Piece<PieceId, TCoord>>,
    private readonly placements: Map<string, Placement<TCoord>>,
    public moves = 0,
    public score = 0,
  ) {}

  // Two pieces with the same id throw a RangeError, because a move names its piece by id.
  static start<TCoord>(
    stateId: GameStateId,
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
    return new FitState(stateId, matchId, figure.clone(), pieces, new Map());
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
  // An unknown piece, or a cell outside the figure, throws a RangeError before any change.
  place(id: PieceId, placement: Placement<TCoord>): void {
    const piece = this.pieces.get(id.value);
    if (piece === undefined) throw new RangeError(`The level has no piece ${id.value}.`);
    const cells = placement.cells(piece, this.board.topology);
    for (const c of cells) {
      if (!this.board.contains(c)) {
        throw new RangeError(`The coordinate ${this.board.topology.key(c)} is outside the board.`);
      }
    }
    for (const c of cells) this.board.occupy(c, id);
    this.placements.set(id.value, placement);
  }

  // Takes the piece off the figure: the board vacates each cell of the piece.
  remove(id: PieceId): void {
    for (const [c, cell] of this.board.cells()) {
      if (cell.equals(id)) this.board.vacate(c);
    }
    this.placements.delete(id.value);
  }

  // Adds one move. The rules call it once for each accepted move.
  countMove(): void {
    this.moves += 1;
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

  // Two states with one `GameStateId` are the same state.
  // Their matches, their boards, their scores and their other values do not count.
  equals(other: BoardState<PieceId, TCoord>): boolean {
    return other instanceof FitState && this.stateId.equals(other.stateId);
  }

  // A piece and an id never change, so the view shares them. `remaining()` and `placed()`
  // build new lists, and the view freezes them.
  view(): FitView<TCoord> {
    return Object.freeze({
      remaining: Object.freeze(this.remaining()),
      placed: Object.freeze(this.placed()),
    });
  }

  // A piece and a placement never change, so the clone shares them.
  // The map of the placements changes in place, so the clone takes its own copy of the map.
  // The clone keeps the ids and the move count, so undo gives back the count before the move.
  clone(): FitState<TCoord> {
    return new FitState(
      this.stateId,
      this.matchId,
      this.board.clone(),
      this.pieces,
      new Map(this.placements),
      this.moves,
      this.score,
    );
  }
}
