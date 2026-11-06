# Rules suite gate fixtures

Wrong trees for `test/gates/rules-suite-gate.test.ts`. Each folder is a repository root.

- `missing-suite/`: the variant `hexa-fit` has `rules.test.ts`, not `fit-rules.test.ts`, so it has no rules suite.
- `engine-double/`: the Lines tests replace the rules contract and `LinesRules` with doubles. They also hold doubles the gate allows: a `Clock`, a generic bound and a `node:fs` mock.
