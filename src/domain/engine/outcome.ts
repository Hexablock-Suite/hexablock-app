// The result of a turn for the game as a whole (classes.md decision 45, issue #207).
// It is a value object with a closed set of three instances: `playing`, `victory` and `gameOver`.
// Each value has one shared instance, which is frozen. So `equals()` compares two outcomes
// by identity, and no code compares a text to know an outcome.
// A JSON body keeps the text. `of()` turns a text into its outcome and refuses an unknown text.
// `toString()` gives the text back. The name of the operation that gives the text to an adapter
// is an open question (README table «Primitive types»).
export class Outcome {
  static readonly playing = new Outcome('playing');
  static readonly victory = new Outcome('victory');
  static readonly gameOver = new Outcome('game-over');

  // The closed set by its texts. A `Map` has no inherited keys,
  // so a text such as `constructor` names no outcome.
  private static readonly byName: ReadonlyMap<string, Outcome> = new Map(
    [Outcome.playing, Outcome.victory, Outcome.gameOver].map((outcome) => [outcome.name, outcome]),
  );

  private constructor(private readonly name: string) {
    // `private` holds only at compile time. The set exists after the last instance,
    // so the constructor refuses every later call.
    if (Outcome.byName !== undefined) throw new RangeError('The set of outcomes is closed.');
    Object.freeze(this);
  }

  // The outcome that a text names. An unknown text throws a RangeError.
  static of(name: string): Outcome {
    const found = Outcome.byName.get(name);
    if (found === undefined) throw new RangeError(`Unknown outcome: ${name}.`);
    return found;
  }

  // Two outcomes are equal when they are the same instance.
  equals(other: Outcome): boolean {
    return this === other;
  }

  // Tells if the game ends with this outcome. Only `playing` keeps the game.
  endsTheGame(): boolean {
    return !this.equals(Outcome.playing);
  }

  // The text of the outcome, as a JSON body holds it.
  toString(): string {
    return this.name;
  }
}
