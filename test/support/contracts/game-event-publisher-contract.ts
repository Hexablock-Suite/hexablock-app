import type { GameEventPublisher } from '../../../src/application/game-event-publisher';
import { GameEnded } from '../../../src/domain/engine/game-events';
import { GameId } from '../../../src/domain/shared/game-id';
import { Outcome } from '../../../src/domain/engine/outcome';
import { Score } from '../../../src/domain/shared/score';
import { MATCH_ID } from '../engine/match-id';

// The contract of the `GameEventPublisher` port (classes.md decision 25, issue #162).
// The test fake and every adapter of the port run the same suite.
// `ApplyMove` saves the turn before it publishes, so a publisher accepts every event.
// `make()` gives a new publisher for each test.
export function describeGameEventPublisherContract(
  name: string,
  make: () => GameEventPublisher,
): void {
  describe(`${name} as a GameEventPublisher`, () => {
    const lost = new GameEnded(GameId.of('hexa-lines'), MATCH_ID, Outcome.gameOver, Score.of(10));
    const won = new GameEnded(GameId.of('hexa-fit'), MATCH_ID, Outcome.victory, Score.of(0));

    it('should_accept_the_event_when_a_game_ended_event_is_published', () => {
      expect(() => make().publish(lost)).not.toThrow();
    });

    it('should_accept_each_event_when_two_events_are_published_in_a_row', () => {
      const publisher = make();

      expect(() => {
        publisher.publish(lost);
        publisher.publish(won);
      }).not.toThrow();
    });
  });
}
