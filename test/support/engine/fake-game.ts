import { Board } from '../../../src/domain/engine/board';
import type { BoardId } from '../../../src/domain/engine/board-id';
import { BoardSnapshot, type BoardState } from '../../../src/domain/engine/board-state';
import { GameId } from '../../../src/domain/shared/game-id';
import type { GameStateId } from '../../../src/domain/engine/game-state-id';
import { HighScoreProgress } from '../../../src/domain/progress/high-score-progress';
import type { MatchId } from '../../../src/domain/engine/match-id';
import { Outcome } from '../../../src/domain/engine/outcome';
import type { IPieceSource } from '../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Resolution } from '../../../src/domain/engine/resolution';
import { BaseGameRules } from '../../../src/domain/engine/rules';
import { Score } from '../../../src/domain/shared/score';
import type { IScoringPolicy } from '../../../src/domain/engine/scoring-policy';
import type { IVariantFactory } from '../../../src/domain/engine/variant-factory';
import type { FakeCell } from './fake-cell';
import { MATCH_ID } from './match-id';
import { squareTopology, type SquareAxis, type SquareCoord } from './square-topology';
import { BOARD_ID, STATE_ID } from './entity-ids';

// A fake game that exists only in test/ (APP-NFR-13). No variant uses these classes.

export interface FakeMove {
  readonly at: SquareCoord;
  readonly cell: FakeCell;
}

// The photo of a fake state: its board, its score, its ids and the count of filled cells.
// It extends the engine photo, as a variant photo does, so it asks the same queries.
export class FakeSnapshot extends BoardSnapshot<FakeCell, SquareCoord, SquareAxis> {
  private readonly shown: { readonly filled: number };

  constructor(
    stateId: GameStateId,
    matchId: MatchId,
    board: Board<FakeCell, SquareCoord, SquareAxis>,
    score: Score,
  ) {
    super(stateId, matchId, board, score);
    this.shown = Object.freeze({ filled: board.occupiedCells().length });
    Object.freeze(this);
  }

  view(): { readonly filled: number } {
    return this.shown;
  }
}

// Its identity is its own `GameStateId`, as in a variant state, and it keeps the `MatchId`
// of its game. The defaults are `STATE_ID` and `MATCH_ID`.
// A test double keeps its fields public, so the fake rules can change it directly.
export class FakeState implements BoardState<FakeCell, SquareCoord> {
  constructor(
    readonly board: Board<FakeCell, SquareCoord, SquareAxis>,
    public score: Score = Score.of(0),
    private readonly matchId: MatchId = MATCH_ID,
    private readonly stateId: GameStateId = STATE_ID,
  ) {}

  belongsTo(match: MatchId): boolean {
    return this.matchId.equals(match);
  }

  equals(other: BoardState<FakeCell, SquareCoord>): boolean {
    return other instanceof FakeState && this.stateId.equals(other.stateId);
  }

  addPoints(points: Score): void {
    this.score = this.score.add(points);
  }

  clone(): FakeState {
    return new FakeState(this.board.clone(), this.score, this.matchId, this.stateId);
  }

  // The view holds the count of filled cells, so a test sees the view of each state.
  snapshot(): FakeSnapshot {
    return new FakeSnapshot(this.stateId, this.matchId, this.board.clone(), this.score);
  }

  restore(snapshot: FakeSnapshot): void {
    this.board.restore(snapshot.boardCopy());
    this.score = snapshot.scoreSoFar();
  }
}

// A square board of size × size empty cells, the state `stateId` of the match `matchId`.
export function emptyState(
  size = 2,
  matchId: MatchId = MATCH_ID,
  stateId: GameStateId = STATE_ID,
  boardId: BoardId = BOARD_ID,
): FakeState {
  return new FakeState(
    new Board(boardId, squareTopology.region(RegionSize.of(size)), squareTopology),
    Score.of(0),
    matchId,
    stateId,
  );
}

// The photo of a state with a source: the source at its position.
// A test double keeps the source public, so a test reads its pieces directly.
export class SourceSnapshot extends BoardSnapshot<FakeCell, SquareCoord, SquareAxis> {
  constructor(
    stateId: GameStateId,
    matchId: MatchId,
    board: Board<FakeCell, SquareCoord, SquareAxis>,
    score: Score,
    readonly source: IPieceSource<FakeCell>,
  ) {
    super(stateId, matchId, board, score);
    Object.freeze(this);
  }

  view(): undefined {
    return undefined;
  }
}

// A state that holds a piece source, as a variant state does (classes.md decision 31).
// The source is a value, so `clone()`, `snapshot()` and `restore()` share it.
// `draw()` replaces it with the next source, so the engine copy and rollback cover its position.
export class SourceState implements BoardState<FakeCell, SquareCoord> {
  constructor(
    readonly board: Board<FakeCell, SquareCoord, SquareAxis>,
    private source: IPieceSource<FakeCell>,
    public score: Score = Score.of(0),
    private readonly matchId: MatchId = MATCH_ID,
    private readonly stateId: GameStateId = STATE_ID,
  ) {}

  belongsTo(match: MatchId): boolean {
    return this.matchId.equals(match);
  }

  equals(other: BoardState<FakeCell, SquareCoord>): boolean {
    return other.belongsTo(this.matchId);
  }

  addPoints(points: Score): void {
    this.score = this.score.add(points);
  }

  // Takes the next piece, and keeps the next source in place of the source.
  draw(): FakeCell {
    const [piece, rest] = this.source.take();
    this.source = rest;
    return piece;
  }

  clone(): SourceState {
    return new SourceState(this.board.clone(), this.source, this.score, this.matchId, this.stateId);
  }

  snapshot(): SourceSnapshot {
    return new SourceSnapshot(
      this.stateId,
      this.matchId,
      this.board.clone(),
      this.score,
      this.source,
    );
  }

  restore(snapshot: SourceSnapshot): void {
    this.board.restore(snapshot.boardCopy());
    this.source = snapshot.source;
    this.score = snapshot.scoreSoFar();
  }
}

// A square board of size × size empty cells, with `source` in the state.
export function sourceState(source: IPieceSource<FakeCell>, size = 2): SourceState {
  return new SourceState(
    new Board(BOARD_ID, squareTopology.region(RegionSize.of(size)), squareTopology),
    source,
  );
}

// The move is the chosen cell. `apply()` puts the next piece of the state source on it.
// A move is valid on an empty cell inside the board. The game ends when no valid move is left.
export class SourceRules extends BaseGameRules<SquareCoord, SourceState> {
  isValid(state: SourceState, at: SquareCoord): boolean {
    return state.board.contains(at) && state.board.occupantAt(at) === undefined;
  }

  *validMoves(state: SourceState): Iterable<SquareCoord> {
    for (const at of state.board.coordinates()) if (this.isValid(state, at)) yield at;
  }

  apply(state: SourceState, at: SquareCoord): SourceState {
    state.board.occupy(at, state.draw());
    return state;
  }

  resolve(_state: SourceState): Resolution {
    return Resolution.resolved();
  }

  evaluate(state: SourceState): Outcome {
    return this.noValidMove(state) ? Outcome.gameOver : Outcome.playing;
  }
}

// A move is valid on an empty cell inside the board. The game ends when the board is full.
// Every step writes its name to `log`, so a test can check the order of the turn.
export class FakeRules extends BaseGameRules<FakeMove, FakeState> {
  constructor(readonly log: string[] = []) {
    super();
  }

  isValid(state: FakeState, move: FakeMove): boolean {
    this.log.push('isValid');
    return state.board.contains(move.at) && state.board.occupantAt(move.at) === undefined;
  }

  *validMoves(state: FakeState): Iterable<FakeMove> {
    for (const at of state.board.coordinates()) {
      if (state.board.occupantAt(at) === undefined) yield { at, cell: { kind: 'fake', value: 0 } };
    }
  }

  apply(state: FakeState, move: FakeMove): FakeState {
    this.log.push('apply');
    state.board.occupy(move.at, move.cell);
    return state;
  }

  resolve(_state: FakeState): Resolution {
    this.log.push('resolve');
    return Resolution.resolved();
  }

  evaluate(state: FakeState): Outcome {
    this.log.push('evaluate');
    return state.board.occupiedCells().length === state.board.coordinates().length
      ? Outcome.gameOver
      : Outcome.playing;
  }
}

// One point for each accepted move. The engine scores only an accepted move.
export class OnePointScoring implements IScoringPolicy<FakeState> {
  constructor(readonly log: string[] = []) {}

  score(_before: FakeSnapshot, _after: FakeSnapshot): Score {
    this.log.push('score');
    return Score.of(1);
  }
}

// The variant factory of the fake game, on a board of size × size cells.
// It has no undo and no timer, and it keeps a high score.
// The use cases and the game factory cannot name this game.
export function fakeGameFactory(
  size = 2,
): IVariantFactory<FakeCell, SquareCoord, FakeMove, FakeState, FakeCell> {
  return {
    isFor: (gameId) => gameId.equals(GameId.of('fake-game')),
    createRules: () => new FakeRules(),
    createTimer: () => undefined,
    createScoring: () => new OnePointScoring(),
    createPieceSource: () => undefined,
    createBoard: (boardId) => emptyState(size, MATCH_ID, STATE_ID, boardId).board,
    createInitialState: (matchId, stateId, boardId) => emptyState(size, matchId, stateId, boardId),
    createHistory: () => undefined,
    createProgressModel: () => new HighScoreProgress(),
  };
}
