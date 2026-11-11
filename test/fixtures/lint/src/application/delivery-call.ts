// Wrong example: a use case asks a value object to deliver its value.
type Receiver = { receive(value: number): void };
type Score = { deliverTo(receiver: Receiver): void };

export function execute(score: Score): number {
  let points = 0;
  score.deliverTo({ receive: (value) => void (points = value) });
  return points;
}
