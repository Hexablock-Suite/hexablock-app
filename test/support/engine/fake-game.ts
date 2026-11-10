import { Board } from '../../../src/domain/engine/board';
import type { BoardState } from '../../../src/domain/engine/board-state';
import type { GameEvent, GameEventPublisher } from '../../../src/domain/engine/game-events';
import { GameId } from '../../../src/domain/engine/game-id';
import type { Outcome } from '../../../src/domain/engine/outcome';
import type { IPieceSource } from '../../../src/domain/engine/piece-source';
import { RegionSize } from '../../../src/domain/engine/region-size';
import { Resolution } from '../../../src/domain/engine/resolution';
import { BaseGameRules } from '../../../src/domain/engine/rules';
import type { IScoringPolicy } from '../../../src/domain/engine/scoring-policy';
import type { IVariantFactory } from '../../../src/domain/engine/variant-factory';
import type { FakeCell } from './fake-cell';
import { squareTopology, type SquareAxis, type SquareCoord } from './square-topology';

// A fake game that exists only in test/ (APP-NFR-13). No variant uses these classes.

export interface FakeMove {
  readonly at: SquareCoord;
  readonly cell: FakeCell;
}

export class FakeState implements BoardState<FakeCell, SquareCoord> {
  constructor(
    readonly board: Board<FakeCell, SquareCoord, SquareAxis>,
    public score = 0,
  ) {}

  clone(): FakeState {
    return new FakeState(this.board.clone(), this.score);
  }

  // The count of filled cells, so a test sees the view of each state.
  view(): { readonly filled: number } {
    return Object.freeze({ filled: this.board.cells().length });
  }
}

// A square board of size × size empty cells.
export function emptyState(size = 2): FakeState {
  return new FakeState(new Board(squareTopology.region(RegionSize.of(size)), squareTopology));
}

// A state that holds a piece source, as a variant state does (classes.md decision 31).
// `clone()` clones the source, so the engine copy and rollback cover its position.
export class SourceState implements BoardState<FakeCell, SquareCoord> {
  constructor(
    readonly board: Board<FakeCell, SquareCoord, SquareAxis>,
    readonly source: IPieceSource<FakeCell>,
    public score = 0,
  ) {}

  clone(): SourceState {
    return new SourceState(this.board.clone(), this.source.clone(), this.score);
  }

  view(): undefined {
    return undefined;
  }
}

// A square board of size × size empty cells, with `source` in the state.
export function sourceState(source: IPieceSource<FakeCell>, size = 2): SourceState {
  return new SourceState(
    new Board(squareTopology.region(RegionSize.of(size)), squareTopology),
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
    state.board.set(at, state.source.next());
    return state;
  }

  resolve(state: SourceState): Resolution<SourceState> {
    return Resolution.resolved(state);
  }

  evaluate(state: SourceState): Outcome {
    return this.noValidMove(state) ? 'game-over' : 'playing';
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
    state.board.set(move.at, move.cell);
    return state;
  }

  resolve(state: FakeState): Resolution<FakeState> {
    this.log.push('resolve');
    return Resolution.resolved(state);
  }

  evaluate(state: FakeState): Outcome {
    this.log.push('evaluate');
    return state.board.cells().length === state.board.shape.cells.length ? 'game-over' : 'playing';
  }
}

// One point for each accepted move.
export class OnePointScoring implements IScoringPolicy<FakeState> {
  constructor(readonly log: string[] = []) {}

  score(_before: FakeState, resolution: Resolution<FakeState>): number {
    this.log.push('score');
    return resolution.accepted ? 1 : 0;
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
    createBoard: () => emptyState(size).board,
    createInitialState: () => emptyState(size),
    createHistory: () => undefined,
  };
}
