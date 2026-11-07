import type { IGameRules } from '../../../../src/domain/engine/rules';

it('should_name_the_contract_when_the_suite_reads_it', () => {
  const rules: IGameRules<number, number> | undefined = undefined;
  expect(rules).toBeUndefined();
});
