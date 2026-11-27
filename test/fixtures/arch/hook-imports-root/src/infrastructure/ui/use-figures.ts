// Wrong: a hook imports the whole composition root, not the closed interface of the screens.
import { CompositionRoot } from '../composition-root';

export function useFigures(): string[] {
  return new CompositionRoot().figures();
}
