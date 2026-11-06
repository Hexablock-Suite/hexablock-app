// Wrong example for test/gates/engine-game-id-gate.test.ts: a `&&` and a `||` run code for one game id.
export class Engine {
  constructor(private readonly gameId: { value: string }) {}

  play(pause: () => void): void {
    this.gameId.value === 'hexa-fit' && pause();
    this.gameId.value !== 'hexa-sort' || pause();
  }
}
