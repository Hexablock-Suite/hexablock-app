# Rules suite gate fixtures

Wrong trees for `test/gates/rules-suite-gate.test.ts`. Each folder is a repository root.

- `missing-suite/`: the variant `hexa-fit` has `rules.test.ts`, not `fit-rules.test.ts`, so it has no rules suite.
- `engine-double/`: the Lines tests replace the rules contract and `LinesRules` with doubles. They also hold doubles the gate allows: a `Clock`, a generic bound and a `node:fs` mock.
- `unprefixed-folder/`: the variant folders `tetra` and `octo` have no `hexa-` prefix, so the suite name uses the whole folder name. `tetra` has `tetra-rules.test.ts`; `octo` has `rules.test.ts`, so it has no rules suite.
- `engine-test-out-of-scope/`: an engine test under `test/domain/engine/` mocks the rules module and extends `BaseGameRules`. The gate does not scan it, because engine tests need fake subclasses of `BaseGameRules`.
