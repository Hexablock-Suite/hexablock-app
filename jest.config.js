/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Fixtures hold wrong examples for the gate tests. They are not tests.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/test/fixtures/'],
};
