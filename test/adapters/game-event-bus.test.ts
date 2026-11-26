/** @jest-environment node */
import { GameEventBus } from '../../src/adapters/game-event-bus';
import { ApplyMove } from '../../src/application/apply-move';
import { GameOver } from '../../src/domain/engine/game-events';
import { GameId } from '../../src/domain/engine/game-id';
import { Outcome } from '../../src/domain/engine/outcome';
import { Score } from '../../src/domain/engine/score';
import { PlacePiece } from '../../src/domain/variants/hexa-lines/place-piece';
import { TrayPosition } from '../../src/domain/variants/hexa-lines/tray-position';
import { RecordingListener } from '../support/adapters/recording-listener';
import { MemoryGameRepository, valueOf } from '../support/application/game-use-cases';
import { describeGameEventPublisherContract } from '../support/contracts/game-event-publisher-contract';
import { MATCH_ID } from '../support/engine/match-id';
import { square, squareTopology } from '../support/engine/square-topology';
import { linesGame, linesState, piece } from '../support/variants/hexa-lines/lines-game';

// Issue #362: `GameEventBus` implements the `GameEventPublisher` port (view 4.3, Observer).
// It gives each event to its listeners in the order of subscription.

describeGameEventPublisherContract('GameEventBus', () => new GameEventBus());
describeGameEventPublisherContract('GameEventBus with a listener', () => {
  const bus = new GameEventBus();
  bus.subscribe(new RecordingListener('listener'));
  return bus;
});

const LOST = new GameOver(GameId.of('hexa-lines'), MATCH_ID, Outcome.gameOver, Score.of(10));

describe('GameEventBus', () => {
  it('should_give_the_event_to_both_listeners_in_the_order_of_subscription_when_two_listeners_subscribe', () => {
    const bus = new GameEventBus();
    const calls: string[] = [];
    const first = new RecordingListener('first', calls);
    const second = new RecordingListener('second', calls);
    bus.subscribe(first);
    bus.subscribe(second);

    bus.publish(LOST);

    expect(calls).toEqual(['first', 'second']);
    expect(first.events()).toEqual([LOST]);
    expect(second.events()).toEqual([LOST]);
  });

  it('should_give_the_event_to_every_listener_and_then_throw_one_error_with_each_failure_when_two_listeners_throw', () => {
    const bus = new GameEventBus();
    const calls: string[] = [];
    const firstFailure = new Error('The sound failed.');
    const lastFailure = new Error('The counter failed.');
    bus.subscribe(new RecordingListener('first', calls, firstFailure));
    const middle = new RecordingListener('middle', calls);
    bus.subscribe(middle);
    bus.subscribe(new RecordingListener('last', calls, lastFailure));

    let thrown: unknown;
    try {
      bus.publish(LOST);
    } catch (error) {
      thrown = error;
    }

    expect(calls).toEqual(['first', 'middle', 'last']);
    expect(middle.events()).toEqual([LOST]);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('2 of 3 listeners refused the event.');
    expect((thrown as Error).cause).toEqual([firstFailure, lastFailure]);
  });

  it('should_give_no_event_to_the_listener_when_it_unsubscribed_before_the_event', () => {
    const bus = new GameEventBus();
    const calls: string[] = [];
    const leaving = new RecordingListener('leaving', calls);
    const staying = new RecordingListener('staying', calls);
    const unsubscribe = bus.subscribe(leaving);
    bus.subscribe(staying);

    unsubscribe();
    bus.publish(LOST);

    expect(calls).toEqual(['staying']);
    expect(leaving.events()).toEqual([]);
  });

  // `ApplyMove` counts one throw of the publisher as one failed delivery (decision 29).
  // So two listeners that refuse one event give one failed delivery, and the move is saved.
  it('should_answer_success_with_one_failed_delivery_when_two_listeners_of_the_bus_refuse_the_event_of_a_move', async () => {
    const bus = new GameEventBus();
    const calls: string[] = [];
    bus.subscribe(new RecordingListener('first', calls, new Error('The sound failed.')));
    bus.subscribe(new RecordingListener('second', calls, new Error('The counter failed.')));
    const games = new MemoryGameRepository();
    games.replace(
      linesGame(
        linesState(squareTopology, 3, {
          filled: [square(1, 0), square(2, 0)],
          tray: [piece(square(0, 0)), piece(square(0, 0))],
        }),
      ).engine as never,
    );

    const result = valueOf(
      await new ApplyMove(games, bus).execute({
        move: new PlacePiece(TrayPosition.of(0), square(0, 0)),
      }),
    );

    expect(calls).toEqual(['first', 'second']);
    expect(result.failedDeliveries?.map((error) => [error.code, error.message])).toEqual([
      ['publish-failed', '2 of 2 listeners refused the event.'],
    ]);
  });
});
