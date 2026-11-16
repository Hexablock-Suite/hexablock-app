import type { GameRepository } from '../../../src/application/game-repository';
import { GameFactory } from '../../../src/domain/engine/game-factory';
import type { FakeCell } from '../engine/fake-cell';
import { fakeGameFactory, type FakeMove, type FakeState } from '../engine/fake-game';
import { CountingMatchIds } from '../engine/match-id';
import type { SquareCoord } from '../engine/square-topology';

// A repository of the fake game. It exists only in test/.
export type FakeGameRepository = GameRepository<FakeCell, SquareCoord, FakeMove, FakeState>;

// The contract of the `GameRepository` port (classes.md decision 10, issue #162).
// The test fake and every adapter of the port run the same suite, so they behave the same.
// `make()` gives a new, empty repository for each test.
// A failed `toBe` prints the whole engine, so the suite compares the roots with `===`.
export function describeGameRepositoryContract(name: string, make: () => FakeGameRepository): void {
  describe(`${name} as a GameRepository`, () => {
    const games = new GameFactory(fakeGameFactory(), new CountingMatchIds());

    it('should_give_no_game_when_no_game_is_saved', () => {
      expect(make().current() === undefined).toBe(true);
    });

    it('should_give_back_the_saved_root_when_a_game_is_saved', () => {
      const repository = make();
      const game = games.createGame();

      repository.replace(game);

      expect(repository.current() === game).toBe(true);
    });

    it('should_give_back_the_last_root_when_a_second_game_replaces_the_first', () => {
      const repository = make();
      const first = games.createGame();
      const second = games.createGame();

      repository.replace(first);
      repository.replace(second);

      expect(repository.current() === second).toBe(true);
    });

    it('should_keep_no_game_of_another_repository_when_two_repositories_exist', () => {
      const saved = make();
      const other = make();

      saved.replace(games.createGame());

      expect(other.current() === undefined).toBe(true);
    });
  });
}
