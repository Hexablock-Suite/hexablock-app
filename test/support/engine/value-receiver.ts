import type { ValueReceiver } from '../../../src/domain/engine/value-receiver';

// Receiving test doubles. They exist only in test/.
// A value object keeps its value private and delivers it to a receiver (issue #228).

// A receiver double. It keeps each value that it receives, in the order of arrival.
export class RecordingReceiver<T> implements ValueReceiver<T> {
  private readonly values: T[] = [];

  receive(value: T): void {
    this.values.push(value);
  }

  received(): readonly T[] {
    return [...this.values];
  }
}

// An object that delivers a value of type `T`.
type Delivers<T> = { deliverTo(receiver: ValueReceiver<T>): void };

// Every value that `source` delivers to one receiver, in the order of arrival.
export function deliveries<T>(source: Delivers<T>): readonly T[] {
  const receiver = new RecordingReceiver<T>();
  source.deliverTo(receiver);
  return receiver.received();
}

// The one value that `source` delivers. A source that delivers no value,
// or more than one value, throws.
export function delivered<T>(source: Delivers<T>): T {
  const values = deliveries(source);
  if (values.length !== 1) {
    throw new Error(`The source delivered ${values.length} values, not 1.`);
  }
  return values[0];
}
