/** @jest-environment node */
import { InMemoryGameRepository } from '../../src/adapters/in-memory-game-repository';
import { MemoryGameRepository } from '../support/application/game-use-cases';
import { describeGameRepositoryContract } from '../support/contracts/game-repository-contract';

// Issue #162: the adapter of the `GameRepository` port runs the contract suite of the port,
// the same suite as the test fake, so a fake and the real adapter behave the same.
describeGameRepositoryContract(
  'MemoryGameRepository (test fake)',
  () => new MemoryGameRepository(),
);
describeGameRepositoryContract('InMemoryGameRepository', () => new InMemoryGameRepository());
