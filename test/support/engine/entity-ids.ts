import { BoardId } from '../../../src/domain/engine/board/board-id';
import { GameStateId } from '../../../src/domain/engine/board/game-state-id';
import { LevelTimerId } from '../../../src/domain/engine/turn/level-timer-id';
import { MATCH_ID } from './match-id';

// The ids of the board, of the state and of the level timer for the tests.
// They exist only in test/. Each id is local: it keeps the `MatchId` of its match (issue #236).
// So the three fixed ids belong to `MATCH_ID`, the match of a test that builds one engine.

// The id of the board of `MATCH_ID`, for a test that compares no boards.
export const BOARD_ID = BoardId.of(MATCH_ID);

// The id of the state of `MATCH_ID`, for a test that compares no states.
export const STATE_ID = GameStateId.of(MATCH_ID);

// The id of the level timer of `MATCH_ID`, for a test that compares no timers.
export const TIMER_ID = LevelTimerId.of(MATCH_ID);
