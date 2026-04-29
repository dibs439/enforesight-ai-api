module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '^../../convex/_generated/api$': '<rootDir>/src/__mocks__/convexApi.ts',
    '^../../../convex/_generated/api$': '<rootDir>/src/__mocks__/convexApi.ts',
    '^\.\./convex/_generated/api$': '<rootDir>/src/__mocks__/convexApi.ts',
    '^\./_generated/api$': '<rootDir>/src/__mocks__/convexApi.ts',
    '^pdfjs-dist/legacy/build/pdf.mjs$': '<rootDir>/src/__mocks__/pdfjsDist.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(convex|pdfjs-dist)/)'],
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
    '**/*.(test|spec).ts',
  ],
  testPathIgnorePatterns: ['<rootDir>/src/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'cobertura', 'html'],
  testTimeout: 10000,
};
