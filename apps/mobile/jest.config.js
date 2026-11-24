module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleNameMapper: {
    '^react-native/unstable-internals-do-not-use$':
      '<rootDir>/../../node_modules/react-native/src/unstable-internals-do-not-use.js',
  },
}
