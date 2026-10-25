const expoPreset = require('jest-expo/jest-preset');

// Fixtures hold wrong examples for the gate tests. They are not tests.
const fixtures = '<rootDir>/test/fixtures/';
const contractTests = '<rootDir>/test/contract/';

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      testPathIgnorePatterns: ['/node_modules/', fixtures, contractTests],
    },
    {
      // Pact starts a real HTTP mock server, so these tests run in plain Node.
      // They reuse the jest-expo TypeScript transform, not its React Native environment.
      displayName: 'contract',
      testEnvironment: 'node',
      roots: [contractTests],
      transform: { '\\.[jt]sx?$': expoPreset.transform['\\.[jt]sx?$'] },
    },
  ],
};
