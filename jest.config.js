/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.ts', '**/src/**/__tests__/**/*.test.ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/index.ts',
        '!src/types/**/*.ts'
    ],
    verbose: true,
    testTimeout: 10000,
    moduleNameMapper: {
        '^@models$': '<rootDir>/src/models',
        '^@models/(.*)$': '<rootDir>/src/models/$1',
        '^@types$': '<rootDir>/src/types',
        '^@types/(.*)$': '<rootDir>/src/types/$1',
        '^@middleware$': '<rootDir>/src/middleware',
        '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
        '^@controllers$': '<rootDir>/src/controllers',
        '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
        '^@services/(.*)$': '<rootDir>/src/services/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@db/(.*)$': '<rootDir>/src/db/$1',
        '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    },
};
