// Wrong: this module imports its interface, but no module imports it (issue #412).
// No route reaches it, so the app never runs it.
import { EventPublisher } from './event-publisher';

export class SilentPublisher implements EventPublisher {
  publish(): string {
    return '';
  }
}
