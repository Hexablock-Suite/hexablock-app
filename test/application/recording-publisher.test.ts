/** @jest-environment node */
import { RecordingPublisher } from '../support/application/recording-publisher';
import { describeGameEventPublisherContract } from '../support/contracts/game-event-publisher-contract';

// The test fake of the `GameEventPublisher` port runs the contract suite of its port,
// as `GameEventBus` does in `test/adapters/game-event-bus.test.ts` (#162, #412).
describeGameEventPublisherContract(
  'RecordingPublisher (test fake)',
  () => new RecordingPublisher(),
);
