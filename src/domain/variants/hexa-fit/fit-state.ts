import type { Board, ReadonlyBoard } from '../../engine/board';
import { BoardSnapshot, checkOwnSnapshot, type BoardState } from '../../engine/board-state';
import type { GameStateId } from '../../engine/game-state-id';
import type { MatchId } from '../../engine/match-id';
import { Moves } from '../../shared/moves';
import { Score } from '../../shared/score';
import type { Piece } from '../../engine/piece';
import type { IPieceSource } from '../../engine/piece-source';
import type { PieceId } from './piece-id';
import { PieceRegister } from './piece-register';
import type { Placement } from './placement';

// The receiver of the data of a `FitView`. An adapter of the edge implements it,
// for example the state mapper of the Fit screen. No code of `src/domain/` or
// `src/application/` calls `deliverTo()` (rule R-no-delivery-call).
export interface FitViewReceiver<TCoord> {
  receive(
    remaining: readonly Piece<PieceId, TCoord>[],
    placed: readonly PieceId[],
    moves: Moves,
  ): void;
}

// The data that the Fit screen draws: the tray, the pieces on the figure and the count
// of the accepted moves (issue #175). Every field is private (issue #245). The view keeps
// frozen copies of the two lists, and `deliverTo()` gives the data to an adapter of the edge.
export class FitView<TCoord> {
  private readonly remaining: readonly Piece<PieceId, TCoord>[];
  private readonly placed: readonly PieceId[];

  constructor(
    remaining: readonly Piece<PieceId, TCoord>[],
    placed: readonly PieceId[],
    private readonly moves: Moves,
  ) {
    this.remaining = Object.freeze([...remaining]);
    this.placed = Object.freeze([...placed]);
    Object.freeze(this);
  }

  // Gives the tray, the placed pieces and the move count to `receiver`. It returns nothing.
  deliverTo(receiver: FitViewReceiver<TCoord>): void {
    receiver.receive(this.remaining, this.placed, this.moves);
  }
}

// The photo of a Fit state (classes.md decision 34): the board, the score, the move count
// and the placement of each piece on the figure, in the order of the placements.
// The pieces of the level never change, so the photo does not hold them.
// `view()` gives the tray, the placed pieces and the move count for the screen.
// Every field is private (issue #245). `FitState.restore()` asks `piecePlacements()` and
// `moveCount()`. The photo keeps a frozen list of frozen pairs, and it is frozen itself.
export class FitSnapshot<TCoord> extends BoardSnapshot<PieceId, TCoord> {
  private readonly placements: readonly (readonly [PieceId, Placement<TCoord>])[];

  constructor(
    stateId: GameStateId,
    matchId: MatchId,
    board: ReadonlyBoard<PieceId, TCoord>,
    score: Score,
    placements: readonly (readonly [PieceId, Placement<TCoord>])[],
    private readonly moves: Moves,
    private readonly shown: FitView<TCoord>,
  ) {
    super(stateId, matchId, board, score);
    this.placements = Object.freeze(
      placements.map(([id, placement]) => Object.freeze([id, placement] as const)),
    );
    Object.freeze(this);
  }

  // The placement of each piece on the figure, in the order of the placements.
  piecePlacements(): readonly (readonly [PieceId, Placement<TCoord>])[] {
    return this.placements;
  }

  // The count of the accepted moves of the game.
  moveCount(): Moves {
    return this.moves;
  }

  view(): FitView<TCoord> {
    return this.shown;
  }
}

// The state of one Hexa Fit game: the figure board, the pieces of the level,
// and the placement of each piece on the figure.
// The board is the figure: its shape holds only the figure cells (REQUIREMENTS.md §1).
// The pieces come from the `FixedListPieceSource` of the `FitLevel`. The state reads it once at start,
// because the player picks the tray pieces in any order.
// The pieces and the placements live in two `PieceRegister` collections, which find an entry
// by `PieceId.equals()` (classes.md decision 49). No text of an id is a key.
// A register is a value: a placement or a removal replaces the register of the placements.
// The register of the placements holds the id object of the level piece.
// `moves` counts the accepted moves of the game for the stars (issue #60).
// It is a `Moves` value object, which checks its own value (classes.md decision 42).
// It is an entity inside the `GameEngine` aggregate (classes.md decisions 7 and 26).
// Its identity is its own `GameStateId`, and `equals()` compares only that identity.
// It also keeps the `MatchId` of its game, and `belongsTo()` reads it.
// The state keeps its object, so every business method changes it in place and returns nothing:
// `place()`, `remove()`, `countMove()`, `addPoints()` and `restore()`. The engine calls them.
// A refused input throws a RangeError and leaves the whole state as it was.
// The rules ask the photo of `snapshot()`, `piece()` and `placementOf()`.
export class FitState<TCoord> implements BoardState<PieceId, TCoord> {
  private constructor(
    private readonly stateId: GameStateId,
    private readonly matchId: MatchId,
    private readonly board: Board<PieceId, TCoord>,
    private readonly pieces: PieceRegister<Piece<PieceId, TCoord>>,
    private placements: PieceRegister<Placement<TCoord>>,
    private moves: Moves = Moves.of(0),
    private score: Score = Score.of(0),
  ) {}

  // The source gives the pieces of a `FitLevel`, and a level never holds two pieces
  // with one id (classes.md decision 46). So the state does not check the ids again.
  static start<TCoord>(
    stateId: GameStateId,
    matchId: MatchId,
    figure: Board<PieceId, TCoord>,
    source: IPieceSource<Piece<PieceId, TCoord>>,
  ): FitState<TCoord> {
    let pieces = PieceRegister.empty<Piece<PieceId, TCoord>>();
    for (const piece of source) pieces = pieces.with(piece.occupant(), piece);
    return new FitState(stateId, matchId, figure.clone(), pieces, PieceRegister.empty());
  }

  piece(id: PieceId): Piece<PieceId, TCoord> | undefined {
    return this.pieces.find(id);
  }

  placementOf(id: PieceId): Placement<TCoord> | undefined {
    return this.placements.find(id);
  }

  // The tray: the pieces that are not on the figure, in the order of the source.
  remaining(): Piece<PieceId, TCoord>[] {
    return this.pieces
      .entries()
      .filter(([id]) => !this.placements.has(id))
      .map(([, piece]) => piece);
  }

  // The placed pieces, in the order of the source.
  placed(): PieceId[] {
    return this.pieces
      .entries()
      .map(([id]) => id)
      .filter((id) => this.placements.has(id));
  }

  // Puts the piece on the cells of `placement`. The rules check the move before.
  // An unknown piece, or a cell outside the figure, throws a RangeError before any change.
  place(id: PieceId, placement: Placement<TCoord>): void {
    const piece = this.pieceOf(id);
    const cells = placement.cells(piece, this.board);
    for (const c of cells) {
      if (!this.board.contains(c)) {
        throw new RangeError('The coordinate is outside the board.', {
          cause: this.board.key(c),
        });
      }
    }
    for (const c of cells) this.board.occupy(c, id);
    this.placements = this.placements.with(piece.occupant(), placement);
  }

  // Takes the piece off the figure: the board vacates each cell of the piece.
  remove(id: PieceId): void {
    for (const [c, cell] of this.board.occupiedCells()) {
      if (cell.equals(id)) this.board.vacate(c);
    }
    this.placements = this.placements.without(id);
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
    return new FitSnapshot(
      this.stateId,
      this.matchId,
      this.board.clone(),
      this.score,
      this.placements.entries(),
      this.moves,
      new FitView(this.remaining(), this.placed(), this.moves),
    );
  }

  // Takes back a photo of this state, in place. A photo of another state, of another board
  // or of a piece that the level does not have changes nothing.
  // The move count of a photo is a `Moves`, which is valid when it exists.
  restore(snapshot: FitSnapshot<TCoord>): void {
    checkOwnSnapshot(this.stateId, this.board, snapshot);
    let placements = PieceRegister.empty<Placement<TCoord>>();
    for (const [id, placement] of snapshot.piecePlacements()) {
      placements = placements.with(this.pieceOf(id).occupant(), placement);
    }
    this.board.restore(snapshot.boardCopy());
    this.placements = placements;
    this.moves = snapshot.moveCount();
    this.score = snapshot.scoreSoFar();
  }

  // The level piece of the id. An id of no level piece throws a RangeError.
  // The error carries the id as its `cause`, and the edge delivers its text (issue #237).
  private pieceOf(id: PieceId): Piece<PieceId, TCoord> {
    const piece = this.pieces.find(id);
    if (piece === undefined) {
      throw new RangeError('The level has no piece with this id.', { cause: id });
    }
    return piece;
  }

  // A piece, a placement and a register never change, so the clone shares them.
  // The clone keeps the ids and the move count, so undo gives back the count before the move.
  clone(): FitState<TCoord> {
    return new FitState(
      this.stateId,
      this.matchId,
      this.board.clone(),
      this.pieces,
      this.placements,
      this.moves,
      this.score,
    );
  }
}
