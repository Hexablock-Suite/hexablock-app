// Right: the route imports this use case, so a route reaches it.
import { EventPublisher } from '../domain/engine/event-publisher';

export function startGame(): string {
  const publisher: EventPublisher = { publish: () => 'started' };
  return publisher.publish();
}
