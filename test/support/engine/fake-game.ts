import { Board } from '../../../src/domain/engine/board';
import type { BoardState } from '../../../src/domain/engine/board-state';
import type { GameEvent, GameEventPublisher } from '../../../src/domain/engine/game-events';
import type { Outcome } from '../../../src/domain/engine/outcome';
import { Resolution } from '../../../src/domain/engine/resolution';
import { BaseGameRules } from '../../../src/domain/engine/rules';
import type { IScoringPolicy } from '../../../src/domain/engine/scoring-policy';
import type { FakeCell } from './fake-cell';
import { squareTopology, type SquareCoord } from './square-topology';

// A fake game that exists only in test/ (APP-NFR-13). No variant uses these classes.

export interface FakeMove {
  readonly at: SquareCoord;
  readonly cell: FakeCell;
}

export class FakeState implements BoardState<FakeCell, SquareCoord> {
  constructor(
    readonly board: Board<FakeCell, SquareCoord>,
    public score = 0,
  ) {}

  clone(): FakeState {
    return new FakeState(this.board.clone(), this.score);
  }
}

// A square board of size × size empty cells.
export function emptyState(size = 2): FakeState {
  return new FakeState(new Board(squareTopology.region(size), squareTopology));
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
