// The receiver of the value of a value object (issue #228).
// A value object keeps its value private. `deliverTo(receiver)` gives the value to a receiver,
// and no operation returns it. The name is the name of the backend (hexablock-api#90).
// An adapter of the edge implements the receiver, because a screen and a request need
// the number or the text. No code of `src/domain/` or `src/application/` calls `deliverTo()`
// (rule R-no-delivery-call): it compares with `equals()` or calls a business operation.
export interface ValueReceiver<T> {
  receive(value: T): void;
}
