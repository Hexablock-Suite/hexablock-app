import type { GameId } from '../domain/shared/game-id';
import type { RegisteredGame } from './game-registry';
import { boardFigures, registeredGames } from './registered-games';
import { SeededRandomSource } from './seeded-random-source';
import { SystemClock } from './system-clock';

// The ids of the games of every board figure, in the order of the figures and of the registry.
// Each id comes once. The web export renders one page of the game route for each id (#287),
// so a reload of a game screen in the browser finds its page. The export runs it in Node
// at build time, outside the root layout. It builds no composition root (#411).
export function gameRouteIds(): string[] {
  return routeIdsOf(() => true);
}

// The ids of the games with levels of every board figure, in the order of the figures and of the
// registry. Each id comes once. The web export renders one page of the level selector route for
// each id (#173), as it does for the game route (#287).
export function levelRouteIds(): string[] {
  return routeIdsOf((game) => game.hasLevels);
}

// The text of the id of each registered game that `keep` accepts, over every board figure.
// The export starts no game, so the games take the system clock and a random source from it,
// as the composition root of the app does.
function routeIdsOf(keep: (game: RegisteredGame) => boolean): string[] {
  const clock = new SystemClock();
  const random = SeededRandomSource.fromClock(clock);
  const ids = boardFigures().flatMap((figure) =>
    registeredGames(figure, clock, random)
      .filter(keep)
      .map(({ gameId }) => textOf(gameId)),
  );
  return [...new Set(ids)];
}

// The text of `gameId`. This module is an adapter of the edge, so it calls `deliverTo()`.
function textOf(gameId: GameId): string {
  let text = '';
  gameId.deliverTo({
    receive: (value) => {
      text = value;
    },
  });
  return text;
}
