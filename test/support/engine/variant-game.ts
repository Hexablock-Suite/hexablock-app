import type { BoardState } from '../../../src/domain/engine/board-state';
import type { Cloneable } from '../../../src/domain/engine/cloneable';
import { GameEngine } from '../../../src/domain/engine/game-engine';
import type { IGameRules } from '../../../src/domain/engine/rules';
import type { IVariantFactory } from '../../../src/domain/engine/variant-factory';
import { RecordingPublisher } from './fake-game';

// One code path for every variant: it reads only the `IVariantFactory` contract
// (classes.md decision 31). It names no variant and never reads the game id to branch.
// Issue 100 moves this wiring into the `StartGame` use case.
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
    factory.gameId,
    rules,
    factory.createScoring(),
    publisher,
  );
  engine.start(factory.createInitialState());
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
