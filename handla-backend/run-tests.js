#!/usr/bin/env node
// Self-contained test runner using backend's ts-jest + backend's own jest-cli
const path = require('path');
const backendNM = path.join(__dirname, 'node_modules');
const rootNM = path.join(__dirname, '..', 'node_modules');
process.env.NODE_PATH = backendNM + ':' + rootNM + (process.env.NODE_PATH ? ':' + process.env.NODE_PATH : '');
require('module').Module._initPaths();
// Run jest — prefer backend's own jest-cli over root one (version must match)
const jestBin = path.join(backendNM, 'jest-cli', 'bin', 'jest.js');
// Replace argv[1] (this script) with jest so jest sees clean args
process.argv[1] = jestBin;
require(jestBin);
