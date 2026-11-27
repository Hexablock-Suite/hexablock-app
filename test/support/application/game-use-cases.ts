import { ApplyMove } from '../../../src/application/apply-move';
import type { GameEventPublisher } from '../../../src/application/game-event-publisher';
import type { GameFactories } from '../../../src/application/game-factories';
import type { GameRepository } from '../../../src/application/game-repository';
import type { LevelRepository } from '../../../src/application/level-repository';
import { RedoMove } from '../../../src/application/redo-move';
import type { Result, UseCaseError } from '../../../src/application/result';
import { StartGame } from '../../../src/application/start-game';
import { UndoMove } from '../../../src/application/undo-move';
import type { BoardState } from '../../../src/domain/engine/board-state';
import type { Cloneable } from '../../../src/domain/engine/cloneable';
import type { GameEngine } from '../../../src/domain/engine/game-engine';
import { GameFactory } from '../../../src/domain/engine/game-factory';
import type { GameId } from '../../../src/domain/shared/game-id';
import { TopologyId } from '../../../src/domain/shared/topology-id';
import type { LevelId } from '../../../src/domain/progress/level-id';
import type { MatchIdGenerator } from '../../../src/domain/engine/match-id-generator';
import type { IVariantFactory } from '../../../src/domain/engine/variant-factory';
import { CountingMatchIds } from '../engine/match-id';
import { gameIdOf } from '../engine/variant-game';
import { RecordingPublisher } from './recording-publisher';

// Helpers for the game use case tests. They exist only in test/.

// A test double of the `GameRepository` port, the repository of the game aggregate.
// It keeps zero or one engine in memory.
// `InMemoryGameRepository` of layer 3 comes with the composition root.
export class MemoryGameRepository<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
> implements GameRepository<TCell, TCoord, TMove, TState> {
  private game: GameEngine<TCell, TCoord, TMove, TState> | undefined;

  current(): GameEngine<TCell, TCoord, TMove, TState> | undefined {
    return this.game;
  }

  replace(game: GameEngine<TCell, TCoord, TMove, TState>): void {
    this.game = game;
  }

  // The running engine. A test that expects a game and finds none fails here.
  running(): GameEngine<TCell, TCoord, TMove, TState> {
    if (this.game === undefined) throw new RangeError('No game is running.');
    return this.game;
  }
}

// A test double of the `GameFactories` port (issue #172). It gives the one factory `factory`
// to a start with no level id, and it rejects a level id, as a game with no levels does.
// `LevelGameFactories` of layer 3 comes with the composition root.
export function factoriesOf<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(factory: GameFactory<TCell, TCoord, TMove, TState>): GameFactories<TCell, TCoord, TMove, TState> {
  return {
    factoryFor: async (levelId?: LevelId) => {
      if (levelId !== undefined) {
        throw new RangeError('The game has no level with this id.', { cause: levelId });
      }
      return factory;
    },
  };
}

// A test double of the `LevelRepository` port for a game with no levels.
export const noLevels: LevelRepository = {
  list: async () => [],
  levelOf: async () => undefined,
  unavailable: async () => [],
};

// A `StartGame` of the game `gameId` on the hexagon over `factories` and `games`, as the root
// builds it for a game with no levels (#397). With no level, no level id can start.
export function startGameOver<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
>(
  factories: GameFactories<TCell, TCoord, TMove, TState>,
  games: GameRepository<TCell, TCoord, TMove, TState>,
  gameId: GameId,
): StartGame<TCell, TCoord, TMove, TState> {
  return new StartGame(factories, games, noLevels, undefined, gameId, TopologyId.hex);
}

// The game use cases of one variant over one shared repository.
// `ApplyMove` delivers the events of each turn to `events`. Its success carries each publisher
// failure as a failed delivery (issues 132, 233 and #342).
// `ids` gives the id of each game that `StartGame` opens. The first state of each game
// and its board take ids that `GameFactory` builds from that id (issue #236).
export function gameUseCases<
  TCell,
  TCoord,
  TMove,
  TState extends BoardState<TCell, TCoord> & Cloneable<TState>,
  TPiece,
>(
  factory: IVariantFactory<TCell, TCoord, TMove, TState, TPiece>,
  events: GameEventPublisher = new RecordingPublisher(),
  ids: MatchIdGenerator = new CountingMatchIds(),
) {
  const games = new MemoryGameRepository<TCell, TCoord, TMove, TState>();
  return {
    games,
    startGame: startGameOver(
      factoriesOf(new GameFactory(gameIdOf(factory), factory, ids)),
      games,
      gameIdOf(factory),
    ),
    applyMove: new ApplyMove(games, events),
    undoMove: new UndoMove(games),
    redoMove: new RedoMove(games),
  };
}

// The value of a success. A failure fails the test with its error code.
export function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw new RangeError(`Expected a success, got ${result.error.code}.`);
  return result.value;
}

// The error of a failure. A success fails the test.
export function errorOf<T>(result: Result<T>): UseCaseError {
  if (result.ok) throw new RangeError('Expected a failure, got a success.');
  return result.error;
}
