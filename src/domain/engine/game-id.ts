import type { ValueReceiver } from './value-receiver';

// The id of one game, for example `hexa-lines`. It is an open value object:
// a new variant brings its own id and changes no engine file (classes.md decision 30).
// An id is a lowercase kebab-case slug: words of `a` to `z` and `0` to `9`, joined by one `-`.
// So an id has no space, no tab and no uppercase letter.
// The text is private. `deliverTo()` gives it to a receiver, and no operation returns it.
// Only an adapter of the edge calls `deliverTo()`, for example the local progress repository,
// which saves the progress of each game under a key with this text (issue #164).
// The domain and the use cases call `equals()` (rule R-no-delivery-call).
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class GameId {
  private constructor(private readonly value: string) {}

  static of(value: string): GameId {
    if (value.trim() === '') throw new RangeError('A game id cannot be empty.');
    if (!SLUG.test(value)) {
      throw new RangeError(`The game id "${value}" is not a lowercase kebab-case slug.`);
    }
    return new GameId(value);
  }

  equals(other: GameId): boolean {
    return this.value === other.value;
  }

  // Gives the text of this game id to `receiver`. It returns nothing.
  deliverTo(receiver: ValueReceiver<string>): void {
    receiver.receive(this.value);
  }
}
