// The id of one game, for example `hexa-lines`. It is an open value object:
// a new variant brings its own id and changes no engine file (classes.md decision 30).
export class GameId {
  private constructor(readonly value: string) {}

  static of(value: string): GameId {
    const trimmed = value.trim();
    if (trimmed === '') throw new RangeError('A game id cannot be empty.');
    return new GameId(trimmed);
  }

  equals(other: GameId): boolean {
    return this.value === other.value;
  }
}
