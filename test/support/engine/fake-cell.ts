// A cell type that exists only in the tests (APP-NFR-13, D4).
// No variant uses it, so a test that passes with it proves the engine is generic in `TCell`.
export interface FakeCell {
  readonly kind: 'fake';
  readonly value: number;
}

export function fakeCell(value: number): FakeCell {
  return { kind: 'fake', value };
}
