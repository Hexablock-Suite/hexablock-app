// Right: only the provider of the root imports the composition root.
import { CompositionRoot } from './composition-root';

export function rootOfTheApp(): CompositionRoot {
  return new CompositionRoot();
}
