import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import type { HomePresenter, SavedProgresses } from '../../adapters/home-presenter';
import { GameId } from '../../domain/shared/game-id';
import { TopologyId } from '../../domain/shared/topology-id';
import type { CellShape } from '../../adapters/board/board-layout';
import { useScreenServices } from './screen-services';
import type { WorldTone } from './theme';

// The presenter of the home screen and of the game selector map (#169), from the composition
// root (#411). It holds the ids of the registered games of the board figure `figure`,
// by default the hexagon, the board figures of the root (#171) and the saved progress `saved`
// that the map hook loaded, by default none (#181).
// So a fifth variant adds one registry entry and the selector shows it.
export function useHomePresenter(
  figure: TopologyId = TopologyId.hex,
  saved: SavedProgresses = [],
): HomePresenter {
  return useScreenServices().homePresenter(figure, saved);
}

// The saved progress of each registered game of the board figure `figure`, as the map shows it
// (#181). The hook loads the progress of each game once per figure, through the one
// `LoadProgress` of the root (#410). A failed load keeps no entry, and the screen shows no score:
// the `LoggingAspect` already logged the failure. A root with no store throws a `RangeError`
// before the call, so the catch keeps no entry either. The screen renders before the progress
// arrives and re-renders with it.
export function useSavedProgresses(figure: TopologyId): SavedProgresses {
  const services = useScreenServices();
  // The registered games of the figure, once per figure, so the load runs once per list.
  const games = useMemo(() => services.gameIds(figure), [services, figure]);
  const [saved, setSaved] = useState<SavedProgresses>([]);
  useEffect(() => {
    let active = true;
    void Promise.all(
      games.map(async (gameId) => {
        try {
          const result = await services.loadProgress().execute({ gameId });
          return result.ok ? ([gameId, result.value] as const) : undefined;
        } catch {
          return undefined;
        }
      }),
    ).then((pairs) => {
      if (active) setSaved(pairs.filter((pair) => pair !== undefined));
    });
    return () => {
      active = false;
    };
  }, [services, games]);
  return saved;
}

// The world colors of each game on the map of the board figure `figure` (#298), from the entry
// of the game in the registry of that figure. The map passes the `id` of a `GameChoice`.
// The presenter takes its ids from the same registry, so each id has an entry.
// An id that the registry does not hold throws a RangeError.
export function useGameTones(figure: TopologyId): (gameId: string) => WorldTone {
  const services = useScreenServices();
  return (gameId) => services.gameTone(figure, GameId.of(gameId));
}

// Whether each game on the map of the board figure `figure` has levels (#173), from the entry
// of the game in the registry of that figure. The map opens the level selector of a game with
// levels, Fit and Sort, and the game route of a game with none, Lines and Merge. The map passes
// the `id` of a `GameChoice`, so no screen branches on the game id.
// An id that the registry does not hold throws a RangeError.
export function useGameLevels(figure: TopologyId): (gameId: string) => boolean {
  const services = useScreenServices();
  return (gameId) => services.hasLevels(figure, GameId.of(gameId));
}

// The shape of a board figure for a stone or a glyph (#297), from the composition root.
// A screen passes the text of the figure, as a `FigureChoice` and a route hold it,
// and the size of the longer side of the shape. So no screen branches on the figure.
// A text that names no figure of the root throws a RangeError.
export function useFigureShapes(): (figure: string, size: number) => CellShape {
  const services = useScreenServices();
  return (figure, size) => services.figureShape(TopologyId.of(figure), size);
}

// The board figure of a route (#171): its `TopologyId`, and its text for the next route.
export interface RouteFigure {
  readonly figure: TopologyId;
  readonly param: string;
}

// The board figure that the `figure` parameter of the route names. The home screen passes
// the text of the chosen figure to the game selector map, and the map passes it on to the game
// route. A route with no figure takes the first figure of the root, the hexagon.
// A text that names no figure of the root gives `undefined`, and the route goes back home.
export function useRouteFigure(): RouteFigure | undefined {
  const { figure } = useLocalSearchParams<{ figure?: string }>();
  const figures = useHomePresenter().home().figures;
  const choice = figure === undefined ? figures[0] : figures.find(({ id }) => id === figure);
  return choice === undefined ? undefined : { figure: TopologyId.of(choice.id), param: choice.id };
}
