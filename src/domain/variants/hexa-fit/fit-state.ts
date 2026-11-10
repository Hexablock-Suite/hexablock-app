import type { Board } from '../../engine/board';
import { checkOwnSnapshot, type BoardSnapshot, type BoardState } from '../../engine/board-state';
import type { GameStateId } from '../../engine/game-state-id';
import type { MatchId } from '../../engine/match-id';
import { Moves } from '../../engine/moves';
import { Score } from '../../engine/score';
import type { Piece } from '../../engine/piece';
import type { IPieceSource } from '../../engine/piece-source';
import type { PieceId } from './piece-id';
import type { Placement } from './placement';

// The data that the Fit screen draws: the tray and the pieces on the figure.
export interface FitView<TCoord> {
  readonly remaining: readonly Piece<PieceId, TCoord>[];
  readonly placed: readonly PieceId[];
}

// The photo of a Fit state (classes.md decision 34): the board, the score, the move count
// and the placement of each piece on the figure, in the order of the placements.
// The pieces of the level never change, so the photo does not hold them.
// `view()` gives the tray and the placed pieces for the screen.
export interface FitSnapshot<TCoord> extends BoardSnapshot<PieceId, TCoord> {
  readonly placements: readonly (readonly [PieceId, Placement<TCoord>])[];
  readonly moves: Moves;
  view(): FitView<TCoord>;
}

// The state of one Hexa Fit game: the figure board, the pieces of the level,
// and the placement of each piece on the figure.
// The board is the figure: its shape holds only the figure cells (REQUIREMENTS.md §1).
// The pieces come from the level's `FixedListPieceSource`. The state reads it once at start,
// because the player picks the tray pieces in any order.
// The maps use the text of the piece id as key, because a Map compares a string by value.
// `moves` counts the accepted moves of the game for the stars (issue #60).
// It is a `Moves` value object, which checks its own value (classes.md decision 42).
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is its own `GameStateId`, and `equals()` compares only that identity.
// It also keeps the `MatchId` of its game, and `belongsTo()` reads it.
// The state keeps its object, so every business method changes it in place and returns nothing:
// `place()`, `remove()`, `countMove()`, `addPoints()` and `restore()`. The engine calls them.
// A refused input throws a RangeError and leaves the whole state as it was.
// The rules read the photo of `snapshot()` and ask `piece()` and `placementOf()`.
export class FitState<TCoord> implements BoardState<PieceId, TCoord> {
  private constructor(
    private readonly stateId: GameStateId,
    private readonly matchId: MatchId,
    private readonly board: Board<PieceId, TCoord>,
    private readonly pieces: ReadonlyMap<string, Piece<PieceId, TCoord>>,
    private readonly placements: Map<string, Placement<TCoord>>,
    private moves: Moves = Moves.of(0),
    private score: Score = Score.of(0),
  ) {}

  // Two pieces with the same id throw a RangeError, because a move names its piece by id.
  static start<TCoord>(
    stateId: GameStateId,
    matchId: MatchId,
    figure: Board<PieceId, TCoord>,
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

  // Adds one move, in place. The rules call it once for each accepted move.
  // The state replaces its `Moves` with the next count.
  countMove(): void {
    this.moves = this.moves.plusOne();
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
  equals(other: BoardState<PieceId, TCoord>): boolean {
    return other instanceof FitState && this.stateId.equals(other.stateId);
  }

  // The photo of the state now. A piece, an id and a placement never change,
  // so the photo shares them. It holds frozen lists and a copy of the board.
  snapshot(): FitSnapshot<TCoord> {
    const placements = Object.freeze(
      [...this.placements].map(([key, placement]) =>
        Object.freeze([this.idOf(key), placement] as const),
      ),
    );
    const view = Object.freeze({
      remaining: Object.freeze(this.remaining()),
      placed: Object.freeze(this.placed()),
    });
    return Object.freeze({
      stateId: this.stateId,
      matchId: this.matchId,
      board: this.board.clone(),
      score: this.score,
      placements,
      moves: this.moves,
      view: () => view,
    });
  }

  // Takes back a photo of this state, in place. A photo of another state, of another board
  // or of a piece that the level does not have changes nothing.
  // The move count of a photo is a `Moves`, which is valid when it exists.
  restore(snapshot: FitSnapshot<TCoord>): void {
    checkOwnSnapshot(this.stateId, this.board, snapshot);
    for (const [id] of snapshot.placements) {
      if (!this.pieces.has(id.value)) throw new RangeError(`The level has no piece ${id.value}.`);
    }
    this.board.restore(snapshot.board);
    this.placements.clear();
    for (const [id, placement] of snapshot.placements) this.placements.set(id.value, placement);
    this.moves = snapshot.moves;
    this.score = snapshot.score;
  }

  // The id of the piece whose id text is `key`. Each key of `placements` names a piece.
  private idOf(key: string): PieceId {
    const piece = this.pieces.get(key);
    if (piece === undefined) throw new RangeError(`The level has no piece ${key}.`);
    return piece.content;
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
