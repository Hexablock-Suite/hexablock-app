// Right example for test/gates/engine-game-id-gate.test.ts: the engine passes the game id
// through and branches only on other values.
export class Engine {
  constructor(private readonly gameId: { value: string }) {}

  over(score: number, publish: (id: { value: string }) => void): string {
    if (score > 100) publish(this.gameId);
    score > 50 && publish(this.gameId);
    const labels = ['empty', 'played'];
    return labels[score === 0 ? 0 : 1];
  }
}
