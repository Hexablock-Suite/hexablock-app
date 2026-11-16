// The baseline lists of the two domain gates (issue #231).
// Each entry is a break that the code of `src/domain/` has today.
// Each entry names the open issue that removes it.
// A gate fails when the code has a break with no entry.
// A gate also fails when an entry names a break that the code no longer has.
// So each list only shrinks: the pull request that closes an issue deletes its entries.

// A primitive in a public signature: `test/docs/primitive-types.test.ts` (APP-NFR-25).
export type PrimitiveEntry = { primitive: 'number' | 'string'; where: string; issue: number };

// A field that is not private, or a getter: `test/docs/domain-private-fields.test.ts`
// (rule R-domain-private-fields).
export type FieldEntry = { rule: 'field' | 'get'; where: string; issue: number };

export const primitiveBaseline: readonly PrimitiveEntry[] = [
  // #246: the team decides whether a branded key counts as a primitive.
  { primitive: 'string', where: 'CoordKey', issue: 246 },
  { primitive: 'string', where: 'coordKey', issue: 246 },
];

export const fieldBaseline: readonly FieldEntry[] = [];
