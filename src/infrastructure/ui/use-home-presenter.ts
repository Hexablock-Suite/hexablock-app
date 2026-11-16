import { HomePresenter } from '../../adapters/home-presenter';
import { DEFAULT_LANGUAGE, textCatalog } from '../../adapters/texts/text-catalog';
import { useCompositionRoot } from '../composition-root-provider';

// The presenter of the home screen and of the game selector map (#169).
// It takes the ids of the registered games from the game registry of the composition root,
// so a fifth variant adds one registry entry and the selector shows it.
// The screens show the default language until the player can choose one (#163).
export function useHomePresenter(): HomePresenter {
  const root = useCompositionRoot();
  return new HomePresenter(root.registry().gameIds(), textCatalog[DEFAULT_LANGUAGE]);
}
