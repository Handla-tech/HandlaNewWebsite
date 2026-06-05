const path = require('path');
const backendNM = path.resolve(__dirname, 'node_modules');
const rootNM = path.resolve(__dirname, '..', 'node_modules');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: __dirname,
  testRegex: '\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: path.join(__dirname, 'tsconfig.json'),
      diagnostics: false,
      isolatedModules: true,
    }],
  },
  modulePaths: [backendNM, rootNM],
  moduleDirectories: ['node_modules'],
  moduleNameMapper: {
    '^bcrypt$': path.join(__dirname, 'src/__mocks__/bcrypt.js'),
    '\\.node$': path.join(__dirname, 'src/__mocks__/native-module.js'),
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: path.join(__dirname, 'coverage'),
  testEnvironment: 'node',
  testTimeout: 15000,
  maxWorkers: 1,
};
