// Architecture gate. Inner layers never know outer layers.
// Paths match "src/<layer>/" at any depth, so the wrong examples in
// test/fixtures/arch/<case>/src/ follow the same rules as src/.
const layer = (name) => `(?:^|/)src/${name}/`;
const framework =
  '(?:^|/)node_modules/(?:react|react-native|expo[^/]*|@expo/[^/]+)/|^(?:react|react-native|expo[^/]*|@expo/[^/]+)(?:/|$)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-imports-only-domain',
      comment: 'Domain code imports only domain code: no outer layer, package or Node module.',
      severity: 'error',
      from: { path: layer('domain') },
      to: { pathNot: layer('domain') },
    },
    {
      name: 'domain-no-framework',
      comment: 'Domain code never imports React, React Native or Expo.',
      severity: 'error',
      from: { path: layer('domain') },
      to: { path: framework },
    },
    {
      name: 'engine-no-variants',
      comment: 'The generic engine never imports a concrete variant.',
      severity: 'error',
      from: { path: layer('domain/engine') },
      to: { path: layer('domain/variants') },
    },
    {
      name: 'shared-imports-only-shared',
      comment:
        'The shared leaves of the domain (src/domain/shared/) import no other folder of the domain (issue #420).',
      severity: 'error',
      from: { path: layer('domain/shared') },
      to: { path: layer('domain'), pathNot: layer('domain/shared') },
    },
    {
      name: 'progress-imports-only-shared',
      comment:
        'The progress and the levels (src/domain/progress/) import only the shared leaves of the domain (issue #420).',
      severity: 'error',
      from: { path: layer('domain/progress') },
      to: { path: layer('domain'), pathNot: '(?:^|/)src/domain/(?:shared|progress)/' },
    },
    {
      name: 'achievements-imports-only-shared-and-progress',
      comment:
        'The achievements (src/domain/achievements/) import only the shared leaves and the progress (issue #420).',
      severity: 'error',
      from: { path: layer('domain/achievements') },
      to: { path: layer('domain'), pathNot: '(?:^|/)src/domain/(?:shared|progress|achievements)/' },
    },
    {
      name: 'variants-isolated',
      comment: 'A variant never imports another variant.',
      severity: 'error',
      from: { path: '(?:^|/)src/domain/variants/([^/]+)/' },
      to: { path: layer('domain/variants'), pathNot: '(?:^|/)src/domain/variants/$1/' },
    },
    {
      name: 'sort-and-merge-no-cell-piece',
      comment:
        'Hexa Sort and Hexa Merge bind their own TPiece (ColorStack, NewTile): they never import the cell-made Piece or the shape Composite of the engine.',
      severity: 'error',
      from: { path: '(?:^|/)src/domain/variants/hexa-(?:sort|merge)/' },
      to: { path: '(?:^|/)src/domain/engine/(?:piece|shape-node)\\.ts$' },
    },
    {
      name: 'application-imports-only-domain',
      comment: 'Application code imports only domain and application code.',
      severity: 'error',
      from: { path: layer('application') },
      to: { pathNot: '(?:^|/)src/(?:domain|application)/' },
    },
    {
      name: 'application-no-variants',
      comment: 'Application code never imports a concrete variant: the use cases stay generic.',
      severity: 'error',
      from: { path: layer('application') },
      to: { path: layer('domain/variants') },
    },
    {
      name: 'board-layouts-no-variants',
      comment:
        'The board layouts of layer 3 (src/adapters/board/) serve every variant, so they import no variant (issue #409).',
      severity: 'error',
      from: { path: layer('adapters/board') },
      to: { path: layer('domain/variants') },
    },
    {
      name: 'ui-no-variants',
      comment:
        'The move controls send a plain intent, and a move mapper of layer 3 builds the domain move: no file of src/infrastructure/ui/ imports a variant (issue #405).',
      severity: 'error',
      from: { path: layer('infrastructure/ui') },
      to: { path: layer('domain/variants') },
    },
    {
      name: 'achievement-listener-no-variants',
      comment:
        'Each event of a variant records its own count through CountsForAchievements, so the achievement listener of layer 3 imports no variant (issue #406).',
      severity: 'error',
      from: { path: '(?:^|/)src/adapters/achievement-counter-listener\\.ts$' },
      to: { path: layer('domain/variants') },
    },
    {
      name: 'level-game-factories-no-variants',
      comment:
        'Each variant folder holds its own level function, so LevelGameFactories of layer 3 imports no variant (issue #407).',
      severity: 'error',
      from: { path: '(?:^|/)src/adapters/level-game-factories\\.ts$' },
      to: { path: layer('domain/variants') },
    },
    {
      name: 'adapters-imports-only-inner-layers',
      comment:
        'Adapter code imports only domain, application and adapter code: no driver, package or Node module.',
      severity: 'error',
      from: { path: layer('adapters') },
      to: { pathNot: '(?:^|/)src/(?:domain|application|adapters)/' },
    },
    {
      name: 'only-provider-imports-root',
      comment:
        'Only the provider of the root imports the composition root. A hook or a route reads the closed interface ScreenServices (issue #411).',
      severity: 'error',
      from: { pathNot: '(?:^|/)src/infrastructure/root-provider\\.tsx$' },
      to: { path: '(?:^|/)src/infrastructure/composition-root\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
