import { useLocalSearchParams } from 'expo-router';

import { HomePresenter } from '../../adapters/home-presenter';
import { DEFAULT_LANGUAGE, textCatalog } from '../../adapters/texts/text-catalog';
import { TopologyId } from '../../domain/engine/geometry-factory';
import { useCompositionRoot } from '../composition-root-provider';

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
