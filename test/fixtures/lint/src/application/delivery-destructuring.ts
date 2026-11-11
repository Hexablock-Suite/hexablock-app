// Wrong example: a use case takes the delivery operation out of a value object by destructuring.
type Receiver = { receive(value: number): void };
type Score = { deliverTo(receiver: Receiver): void };

export function executeWithShorthand(score: Score, receiver: Receiver): void {
  const { deliverTo } = score;
  deliverTo.call(score, receiver);
}

export function executeWithAlias(score: Score, receiver: Receiver): void {
  const { deliverTo: deliver } = score;
  deliver.call(score, receiver);
}

export function executeWithParameter({ deliverTo }: Score, receiver: Receiver): void {
  deliverTo(receiver);
}
