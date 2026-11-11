// Right example: a value object declares its delivery operation, and domain code
// compares two values with equals().
export type ValueReceiver<T> = { receive(value: T): void };

export class Score {
  private constructor(private readonly value: number) {}

  static of(value: number): Score {
    return new Score(value);
  }

  equals(other: Score): boolean {
    return this.value === other.value;
  }

  deliverTo(receiver: ValueReceiver<number>): void {
    receiver.receive(this.value);
  }
}

export const isZero = (score: Score) => score.equals(Score.of(0));
