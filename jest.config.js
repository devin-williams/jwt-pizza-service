module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js', // Entry point, minimal logic
    '!src/config.js', // Configuration file
    '!src/version.json',
    '!src/__tests__/**',
    '!src/__tests__/__mocks__/**',
    '!src/database/**', // Database is mocked in tests
    '!src/model/**', // Model is basic and mocked
    '!src/init.js' // Initialization script
  ],
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    'src/__tests__/setup.js',
    'src/__tests__/__mocks__/'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js']
};