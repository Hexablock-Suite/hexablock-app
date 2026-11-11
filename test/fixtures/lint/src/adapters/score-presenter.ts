// Right example: an adapter of the edge receives the value of a value object.
type Receiver = { receive(value: number): void };
type Score = { deliverTo(receiver: Receiver): void };

export function present(score: Score): string {
  let points = 0;
  score.deliverTo({ receive: (value) => void (points = value) });
  return `${points} points`;
}
