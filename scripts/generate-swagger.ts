/**
 * Generates swagger.json (OpenAPI 3.0) from the existing swagger-jsdoc config.
 * Usage: npx ts-node scripts/generate-swagger.ts
 */
import fs from 'fs';
import path from 'path';

// Bypass test guard so swaggerSpec is always built
process.env.NODE_ENV = 'production';
delete process.env.JEST_WORKER_ID;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { swaggerSpec } = require('../src/config/swagger');

const outPath = path.resolve(__dirname, '../docs/swagger.json');
fs.writeFileSync(outPath, JSON.stringify(swaggerSpec, null, 2), 'utf-8');
console.log(`✅  swagger.json written to ${outPath}`);
