// Wrong example for test/gates/engine-game-id-gate.test.ts: a `switch` whose case is a variant id.
export function stars(name: string): number {
  switch (name) {
    case 'hexa-sort':
      return 0;
    default:
      return 3;
  }
}
