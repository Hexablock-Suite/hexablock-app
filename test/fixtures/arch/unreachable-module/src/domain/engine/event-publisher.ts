// Right: the use case imports this interface, so a route reaches it.
export interface EventPublisher {
  publish(): string;
}
