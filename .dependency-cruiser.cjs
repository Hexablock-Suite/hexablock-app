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
      name: 'variants-isolated',
      comment: 'A variant never imports another variant.',
      severity: 'error',
      from: { path: '(?:^|/)src/domain/variants/([^/]+)/' },
      to: { path: layer('domain/variants'), pathNot: '(?:^|/)src/domain/variants/$1/' },
    },
    {
      name: 'application-imports-only-domain',
      comment: 'Application code imports only domain and application code.',
      severity: 'error',
      from: { path: layer('application') },
      to: { pathNot: '(?:^|/)src/(?:domain|application)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
