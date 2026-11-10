import { Board, type ReadonlyBoard } from '../../../src/domain/engine/board';
import type { BoardId } from '../../../src/domain/engine/board-id';
import type { BoardSnapshot, BoardState } from '../../../src/domain/engine/board-state';
import type { GameEvent, GameEventPublisher } from '../../../src/domain/engine/game-events';
import { GameId } from '../../../src/domain/engine/game-id';
import type { GameStateId } from '../../../src/domain/engine/game-state-id';
import type { MatchId } from '../../../src/domain/engine/match-id';
import { Outcome } from '../../../src/domain/engine/outcome';
import type { IPieceSource } from '../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Resolution } from '../../../src/domain/engine/resolution';
import { BaseGameRules } from '../../../src/domain/engine/rules';
import { Score } from '../../../src/domain/engine/score';
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
export interface FakeSnapshot extends BoardSnapshot<FakeCell, SquareCoord> {
  readonly board: ReadonlyBoard<FakeCell, SquareCoord, SquareAxis>;
  view(): { readonly filled: number };
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
    const view = Object.freeze({ filled: this.board.cells().length });
    return Object.freeze({
      stateId: this.stateId,
      matchId: this.matchId,
      board: this.board.clone(),
      score: this.score,
      view: () => view,
    });
  }

  restore(snapshot: FakeSnapshot): void {
    this.board.restore(snapshot.board);
    this.score = snapshot.score;
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

// The photo of a state with a source: a copy of the source at its position.
export interface SourceSnapshot extends BoardSnapshot<FakeCell, SquareCoord> {
  readonly board: ReadonlyBoard<FakeCell, SquareCoord, SquareAxis>;
  readonly source: IPieceSource<FakeCell>;
  view(): undefined;
}

// A state that holds a piece source, as a variant state does (classes.md decision 31).
// `clone()` clones the source, so the engine copy and rollback cover its position.
// `snapshot()` holds a copy of the source, and `restore()` takes a copy of that copy back.
export class SourceState implements BoardState<FakeCell, SquareCoord> {
  constructor(
    readonly board: Board<FakeCell, SquareCoord, SquareAxis>,
    public source: IPieceSource<FakeCell>,
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

  clone(): SourceState {
    return new SourceState(
      this.board.clone(),
      this.source.clone(),
      this.score,
      this.matchId,
      this.stateId,
    );
  }

  snapshot(): SourceSnapshot {
    return Object.freeze({
      stateId: this.stateId,
      matchId: this.matchId,
      board: this.board.clone(),
      score: this.score,
      source: this.source.clone(),
      view: () => undefined,
    });
  }

  restore(snapshot: SourceSnapshot): void {
    this.board.restore(snapshot.board);
    this.source = snapshot.source.clone();
    this.score = snapshot.score;
  }
}

// A square board of size × size empty cells, with `source` in the state.
export function sourceState(source: IPieceSource<FakeCell>, size = 2): SourceState {
  return new SourceState(
    new Board(BOARD_ID, squareTopology.region(RegionSize.of(size)), squareTopology),
    source,
  );
}

// The move is the chosen cell. `apply()` puts the next piece of `state.source` on it.
// A move is valid on an empty cell inside the board. The game ends when no valid move is left.
export class SourceRules extends BaseGameRules<SquareCoord, SourceState> {
  isValid(state: SourceState, at: SquareCoord): boolean {
    return state.board.contains(at) && state.board.get(at) === undefined;
  }

  *validMoves(state: SourceState): Iterable<SquareCoord> {
    for (const at of state.board.shape.cells) if (this.isValid(state, at)) yield at;
  }

  apply(state: SourceState, at: SquareCoord): SourceState {
    state.board.occupy(at, state.source.next());
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
    return state.board.contains(move.at) && state.board.get(move.at) === undefined;
  }

  *validMoves(state: FakeState): Iterable<FakeMove> {
    for (const at of state.board.shape.cells) {
      if (state.board.get(at) === undefined) yield { at, cell: { kind: 'fake', value: 0 } };
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
    return state.board.cells().length === state.board.shape.cells.length
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

export class RecordingPublisher implements GameEventPublisher {
  readonly events: GameEvent[] = [];

  constructor(readonly log: string[] = []) {}

  publish(event: GameEvent): void {
    this.log.push('publish');
    this.events.push(event);
  }
}

// The variant factory of the fake game, on a board of size × size cells. It has no undo.
// The use cases and the game factory cannot name this game.
export function fakeGameFactory(
  size = 2,
): IVariantFactory<FakeCell, SquareCoord, FakeMove, FakeState, FakeCell> {
  return {
    gameId: GameId.of('fake-game'),
    createRules: () => new FakeRules(),
    createScoring: () => new OnePointScoring(),
    createPieceSource: () => undefined,
    createBoard: (boardId) => emptyState(size, MATCH_ID, STATE_ID, boardId).board,
    createInitialState: (matchId, stateId, boardId) => emptyState(size, matchId, stateId, boardId),
    createHistory: () => undefined,
  };
}
