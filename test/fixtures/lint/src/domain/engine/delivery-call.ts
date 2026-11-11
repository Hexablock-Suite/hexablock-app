// Wrong example: domain code asks a value object to deliver its value.
type Receiver = { receive(value: number): void };
type Score = { deliverTo(receiver: Receiver): void };

export function total(score: Score, bonus: Score | undefined): number {
  let sum = 0;
  const receiver = { receive: (value: number) => void (sum += value) };
  score.deliverTo(receiver);
  bonus?.deliverTo(receiver);
  score['deliverTo'](receiver);
  const later = score.deliverTo.bind(score);
  later(receiver);
  return sum;
}
