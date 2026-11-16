import type { MatchIdGenerator } from '../../../src/domain/engine/match-id-generator';

// The count of ids that the suite asks for.
const IDS = 50;

// The contract of the engine interface `MatchIdGenerator` (classes.md decision 25, issue #162).
// The test fake and every adapter of the interface run the same suite.
// `make()` gives a new generator for each test.
export function describeMatchIdGeneratorContract(name: string, make: () => MatchIdGenerator): void {
  describe(`${name} as a MatchIdGenerator`, () => {
    it('should_give_an_id_that_it_did_not_give_before_when_it_is_asked_again', () => {
      const generator = make();

      const ids = Array.from({ length: IDS }, () => generator.next());
      const repeats = ids.filter((id, index) => ids.slice(0, index).some((e) => e.equals(id)));

      expect(repeats).toHaveLength(0);
    });
  });
}
