// The id of one game, for example `hexa-lines`. It is an open value object:
// a new variant brings its own id and changes no engine file (classes.md decision 30).
// An id is a lowercase kebab-case slug: words of `a` to `z` and `0` to `9`, joined by one `-`.
// So an id has no space, no tab and no uppercase letter.
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
}
