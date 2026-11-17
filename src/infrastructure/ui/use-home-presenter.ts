import { useLocalSearchParams } from 'expo-router';

import { HomePresenter } from '../../adapters/home-presenter';
import { DEFAULT_LANGUAGE, textCatalog } from '../../adapters/texts/text-catalog';
import { GameId } from '../../domain/engine/game-id';
import { TopologyId } from '../../domain/engine/geometry-factory';
import type { CellShape } from '../board/board-layout';
import { useCompositionRoot } from '../composition-root-provider';
import type { WorldTone } from './theme';

// The presenter of the home screen and of the game selector map (#169).
// It takes the ids of the registered games from the game registry of the board figure `figure`,
// by default the hexagon, and the board figures of the composition root (#171).
// So a fifth variant adds one registry entry and the selector shows it.
// The screens show the default language until the player can choose one (#163).
export function useHomePresenter(figure: TopologyId = TopologyId.hex): HomePresenter {
  const root = useCompositionRoot();
  return new HomePresenter(
    root.registry(figure).gameIds(),
    root.figures(),
    textCatalog[DEFAULT_LANGUAGE],
  );
}

// The world colors of each game on the map of the board figure `figure` (#298), from the entry
// of the game in the registry of that figure. The map passes the `id` of a `GameChoice`.
// The presenter takes its ids from the same registry, so each id has an entry.
// An id that the registry does not hold throws a RangeError.
export function useGameTones(figure: TopologyId): (gameId: string) => WorldTone {
  const registry = useCompositionRoot().registry(figure);
  return (gameId) => registry.gameOf(GameId.of(gameId)).tone;
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
