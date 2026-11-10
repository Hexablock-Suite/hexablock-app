import type { BoardState } from '../../../src/domain/engine/board-state';
import type { Cloneable } from '../../../src/domain/engine/cloneable';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import type { IGameRules } from '../../../src/domain/engine/rules';
import type { IVariantFactory } from '../../../src/domain/engine/variant-factory';
import { RecordingPublisher } from './fake-game';
import { MATCH_ID } from './match-id';
import { BOARD_ID, STATE_ID } from './entity-ids';

// One code path for every variant: it reads only the `IVariantFactory` contract
// (classes.md decision 31). It names no variant and never reads the game id to branch.
// `GameFactory` in `src/domain/engine/` holds this wiring for the app (classes.md decision 40).
// This helper stays for the synchronous domain tests that read the rules and the publisher
// of the game. It gives every game the fixed `MATCH_ID`.
export function startVariant<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>) {
  const publisher = new RecordingPublisher();
  const rules = factory.createRules();
  const engine = new GameEngine<TCell, TCoord, TMove, TState>(
    MATCH_ID,
    factory.gameId,
    rules,
    factory.createScoring(),
    publisher,
    factory.createHistory(),
  );
  engine.start(factory.createInitialState(MATCH_ID, STATE_ID, BOARD_ID));
  return { engine, rules, publisher };
}

// The first move of the lazy generator of the rules (classes.md decision 33).
export function firstValidMove<TMove, TState>(
  rules: IGameRules<TMove, TState>,
  state: TState,
): TMove {
  for (const move of rules.validMoves(state)) return move;
  throw new RangeError('The state has no valid move.');
}
