/** @jest-environment node */
import { NullGameEventPublisher } from '../../src/adapters/null-game-event-publisher';
import { RecordingPublisher } from '../support/application/recording-publisher';
import { describeGameEventPublisherContract } from '../support/contracts/game-event-publisher-contract';

// Issue #162: the publisher that does nothing runs the contract suite of its port,
// the same suite as the test fake. The root uses `GameEventBus` since #362, and this publisher
// stays for a caller that needs a publisher with no listener (classes.md decision 25).
describeGameEventPublisherContract(
  'RecordingPublisher (test fake)',
  () => new RecordingPublisher(),
);
describeGameEventPublisherContract('NullGameEventPublisher', () => new NullGameEventPublisher());
