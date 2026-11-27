import { createContext, useContext } from 'react';

import type { AchievementsPresenter } from '../../adapters/achievements-presenter';
import type { GamePresenter } from '../../adapters/game-presenter';
import type { HomePresenter, SavedProgresses } from '../../adapters/home-presenter';
import type { LevelSelectorPresenter } from '../../adapters/level-selector-presenter';
import type { ResultPresenter } from '../../adapters/result-presenter';
import type { BoardLayout, CellShape } from '../../adapters/board/board-layout';
import type { Texts } from '../../adapters/texts/text-catalog';
import type { LoadProgressRequest } from '../../application/load-progress';
import type { UseCase } from '../../application/use-case';
import type { GameProgress } from '../../domain/progress/game-progress';
import type { GameId } from '../../domain/shared/game-id';
import type { TopologyId } from '../../domain/shared/topology-id';
import type { CellRenderer } from '../board/cell-renderer';
import type { MoveControls } from './move-controls';
import type { WorldTone } from './theme';

// What the game screen needs to show one game (issue #170): the presenter over the use cases
// of the game, the cell renderer, the move controls and the figure layout of its registry entry,
// and the texts of the screen (#175). The registry hides the type of a cell view,
// so the session keeps it hidden too. `result` is the presenter of the victory screen and of
// the defeat screen, which hears the end of each game of `presenter` (#180).
export interface GameSession {
  readonly presenter: GamePresenter<unknown, unknown, unknown, unknown, unknown, unknown, unknown>;
  readonly result: ResultPresenter;
  readonly renderer: CellRenderer<unknown>;
  readonly controls: MoveControls<unknown, unknown, unknown, unknown>;
  readonly layoutOf: (size: number) => BoardLayout<unknown>;
  readonly texts: Texts;
}

// The closed interface of the screens (issue #411, decision 18 of the class diagram).
// The composition root implements it, and the React context of the routes holds the root
// as this interface only. So a hook or a route asks for these pieces and for no other piece
// of the root. The root builds a new presenter on each call, and the hook of a screen keeps it
// in React state for the life of that screen. A new method is a new decision of the team.
export interface ScreenServices {
  // The presenter of the home screen and of the game selector map of the board figure
  // `figure`, with the saved progress `saved` of its games (#169, #181).
  homePresenter(figure: TopologyId, saved?: SavedProgresses): HomePresenter;
  // The ids of the registered games of the board figure `figure`, in the order of the registry.
  gameIds(figure: TopologyId): GameId[];
  // The world colors of the game `gameId` on the map of the board figure `figure` (#298).
  gameTone(figure: TopologyId, gameId: GameId): WorldTone;
  // Whether the game `gameId` has levels on the board figure `figure` (#173).
  hasLevels(figure: TopologyId, gameId: GameId): boolean;
  // The shape of the origin cell of the board figure `figure`, `size` points long (#297).
  figureShape(figure: TopologyId, size: number): CellShape;
  // `LoadProgress` over the saved progress of the device (#181, #410).
  loadProgress(): UseCase<LoadProgressRequest, GameProgress | undefined>;
  // A new presenter of the achievements screen (#188).
  achievementsPresenter(): AchievementsPresenter;
  // A new presenter of the level selector of the game `gameId` on the figure `figure` (#173).
  levelSelectorPresenter(gameId: GameId, figure: TopologyId): LevelSelectorPresenter;
  // A new session of the game `gameId` on the board figure `figure` (#170, #171).
  gameSession(gameId: GameId, figure: TopologyId): GameSession;
}

// The screen services of the app for the routes below the root layout.
// `CompositionRootProvider` gives it the composition root.
export const ScreenServicesContext = createContext<ScreenServices | undefined>(undefined);

// The screen services of the app. A component outside the root layout throws an Error.
export function useScreenServices(): ScreenServices {
  const services = useContext(ScreenServicesContext);
  if (services === undefined) {
    throw new Error(
      'The composition root is missing: render the component inside the root layout.',
    );
  }
  return services;
}
