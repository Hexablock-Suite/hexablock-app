import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { HomePresenter, type SavedProgresses } from '../../adapters/home-presenter';
import { DEFAULT_LANGUAGE, textCatalog } from '../../adapters/texts/text-catalog';
import { GameId } from '../../domain/engine/game-id';
import { TopologyId } from '../../domain/engine/geometry-factory';
import type { CellShape } from '../../adapters/board/board-layout';
import { CompositionRoot } from '../composition-root';
import { useCompositionRoot } from '../composition-root-provider';
import type { WorldTone } from './theme';

// The presenter of the home screen and of the game selector map (#169).
// It takes the ids of the registered games from the game registry of the board figure `figure`,
// by default the hexagon, and the board figures of the composition root (#171).
// So a fifth variant adds one registry entry and the selector shows it.
// The screens show the default language until the player can choose one (#163).
export function useHomePresenter(figure: TopologyId = TopologyId.hex): HomePresenter {
  return homePresenterOf(useCompositionRoot(), figure);
}

// The ids of the games of every board figure, in the order of the figures and of the registry.
// Each id comes once. The web export renders one page of the game route for each id (#287),
// so a reload of a game screen in the browser finds its page. The export runs it in Node
// at build time, outside the root layout, so it builds its own composition root.
export function gameRouteIds(): string[] {
  const root = new CompositionRoot();
  const ids = root.figures().flatMap((figure) =>
    homePresenterOf(root, figure)
      .gameSelector()
      .games.map(({ id }) => id),
  );
  return [...new Set(ids)];
}

// The ids of the games with levels of every board figure, in the order of the figures and of the
// registry. Each id comes once. The web export renders one page of the level selector route for
// each id (#173), as it does for the game route (#287).
export function levelRouteIds(): string[] {
  const root = new CompositionRoot();
  const ids = root.figures().flatMap((figure) => {
    const registry = root.registry(figure);
    return homePresenterOf(root, figure)
      .gameSelector()
      .games.filter(({ id }) => registry.gameOf(GameId.of(id)).hasLevels)
      .map(({ id }) => id);
  });
  return [...new Set(ids)];
}

// The home presenter over the registry of the board figure `figure` of the root `root`,
// with the saved progress that the map hook loaded, by default none (#181).
export function homePresenterOf(
  root: CompositionRoot,
  figure: TopologyId,
  saved: SavedProgresses = [],
): HomePresenter {
  return new HomePresenter(
    root.registry(figure).gameIds(),
    root.figures(),
    textCatalog[DEFAULT_LANGUAGE],
    saved,
  );
}

// The saved progress of each registered game `games`, as the map shows it (#181). The hook
// loads the progress of each game once per list, through `loadProgress(gameId)` of the root.
// A failed load keeps no entry, and the screen shows no score: the `LoggingAspect` already
// logged the failure. A root with no store throws a `RangeError` before the call, so the catch
// keeps no entry either. The screen renders before the progress arrives and re-renders with it.
// `games` must stay the same list between renders, as the `useMemo` of the screen gives it.
export function useSavedProgresses(games: readonly GameId[]): SavedProgresses {
  const root = useCompositionRoot();
  const [saved, setSaved] = useState<SavedProgresses>([]);
  useEffect(() => {
    let active = true;
    void Promise.all(
      games.map(async (gameId) => {
        try {
          const result = await root.loadProgress(gameId).execute({});
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
  }, [root, games]);
  return saved;
}

// The world colors of each game on the map of the board figure `figure` (#298), from the entry
// of the game in the registry of that figure. The map passes the `id` of a `GameChoice`.
// The presenter takes its ids from the same registry, so each id has an entry.
// An id that the registry does not hold throws a RangeError.
export function useGameTones(figure: TopologyId): (gameId: string) => WorldTone {
  const registry = useCompositionRoot().registry(figure);
  return (gameId) => registry.gameOf(GameId.of(gameId)).tone;
}

// Whether each game on the map of the board figure `figure` has levels (#173), from the entry
// of the game in the registry of that figure. The map opens the level selector of a game with
// levels, Fit and Sort, and the game route of a game with none, Lines and Merge. The map passes
// the `id` of a `GameChoice`, so no screen branches on the game id.
// An id that the registry does not hold throws a RangeError.
export function useGameLevels(figure: TopologyId): (gameId: string) => boolean {
  const registry = useCompositionRoot().registry(figure);
  return (gameId) => registry.gameOf(GameId.of(gameId)).hasLevels;
}

// The shape of a board figure for a stone or a glyph (#297), from the composition root.
// A screen passes the text of the figure, as a `FigureChoice` and a route hold it,
// and the size of the longer side of the shape. So no screen branches on the figure.
// A text that names no figure of the root throws a RangeError.
export function useFigureShapes(): (figure: string, size: number) => CellShape {
  const root = useCompositionRoot();
  return (figure, size) => root.figureShape(TopologyId.of(figure), size);
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
