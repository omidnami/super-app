const jestExpoPreset = require('jest-expo/jest-preset')

module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: jestExpoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.replace('|expo|', '|expo|@noble|'),
  ),
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleNameMapper: {
    '^react-native/unstable-internals-do-not-use$':
      '<rootDir>/../../node_modules/react-native/src/unstable-internals-do-not-use.js',
  },
}
