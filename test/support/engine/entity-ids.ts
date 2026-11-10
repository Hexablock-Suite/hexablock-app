import { BoardId } from '../../../src/domain/engine/board-id';
import type { BoardIdGenerator } from '../../../src/domain/engine/board-id-generator';
import { GameStateId } from '../../../src/domain/engine/game-state-id';
import type { GameStateIdGenerator } from '../../../src/domain/engine/game-state-id-generator';
import { LevelTimerId } from '../../../src/domain/engine/level-timer-id';
import type { LevelTimerIdGenerator } from '../../../src/domain/engine/level-timer-id-generator';

// The ids of the board, of the state and of the level timer for the tests.
// They exist only in test/.

// One fixed id of a board, for a test that compares no boards.
export const BOARD_ID = BoardId.of('board-under-test');

// One fixed id of a state, for a test that compares no states.
export const STATE_ID = GameStateId.of('state-under-test');

// One fixed id of a level timer, for a test that compares no timers.
export const TIMER_ID = LevelTimerId.of('timer-under-test');

// A generator double. It gives `board-1`, `board-2` and so on,
// so a test knows the id of each board that a game gets.
export class CountingBoardIds implements BoardIdGenerator {
  private made = 0;

  next(): BoardId {
    this.made += 1;
    return BoardId.of(`board-${this.made}`);
  }
}

// A generator double. It gives `state-1`, `state-2` and so on,
// so a test knows the id of each state that a game gets.
export class CountingStateIds implements GameStateIdGenerator {
  private made = 0;

  next(): GameStateId {
    this.made += 1;
    return GameStateId.of(`state-${this.made}`);
  }
}

// A generator double. It gives `timer-1`, `timer-2` and so on,
// so a test knows the id of each level timer that a game gets.
export class CountingTimerIds implements LevelTimerIdGenerator {
  private made = 0;

  next(): LevelTimerId {
    this.made += 1;
    return LevelTimerId.of(`timer-${this.made}`);
  }
}
