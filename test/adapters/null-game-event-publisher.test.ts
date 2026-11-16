/** @jest-environment node */
import { NullGameEventPublisher } from '../../src/adapters/null-game-event-publisher';
import { RecordingPublisher } from '../support/application/recording-publisher';
import { describeGameEventPublisherContract } from '../support/contracts/game-event-publisher-contract';

// Issue #162: the publisher that does nothing runs the contract suite of its port,
// the same suite as the test fake. It stands in for `GameEventBus` of view 4.3.
describeGameEventPublisherContract(
  'RecordingPublisher (test fake)',
  () => new RecordingPublisher(),
);
describeGameEventPublisherContract('NullGameEventPublisher', () => new NullGameEventPublisher());
