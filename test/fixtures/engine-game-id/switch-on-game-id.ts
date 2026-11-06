// Wrong example for test/gates/engine-game-id-gate.test.ts: a `switch` on the game id value.
export class Engine {
  constructor(private readonly gameId: { value: string }) {}

  limit(): number {
    switch (this.gameId.value) {
      case 'hexa-fit':
        return 1;
      default:
        return 3;
    }
  }
}
