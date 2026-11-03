// Jest configuration for the SprintBoard API tests.
//
// - globalSetup: creates the sprintboard_test database (once per run).
// - setupFilesAfterEach-style cleanup lives in tests/helpers.js (truncate
//   between tests) so each test starts from a clean database.
module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/global-setup.js',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // One file at a time: they all share the same test database.
  maxWorkers: 1,
};
