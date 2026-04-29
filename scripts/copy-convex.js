const fs = require('fs');
const path = require('path');

// Create convex/_generated directory in dist
const sourceDir = path.join(__dirname, '..', 'convex', '_generated');
const targetDir = path.join(__dirname, '..', 'dist', 'convex', '_generated');

// Create directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Convert ES module api.js to CommonJS
const apiContent = `/* eslint-disable */
/**
 * Generated API utility (converted to CommonJS for compatibility).
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run \`npx convex dev\`.
 * @module
 */

try {
  const { anyApi, componentsGeneric } = require("convex/server");
  
  const api = anyApi;
  const internal = anyApi;
  const components = componentsGeneric();
  
  module.exports = {
    api: api,
    internal: internal,
    components: components
  };
  
  // Also export individual properties for compatibility
  exports.api = api;
  exports.internal = internal;
  exports.components = components;
} catch (error) {
  console.warn('Failed to load convex/server:', error.message);
  // Provide fallback exports
  const fallbackApi = {
    customers: {},
    contents: {},
    regulators: {}
  };
  
  module.exports = {
    api: fallbackApi,
    internal: fallbackApi,
    components: {}
  };
  
  exports.api = fallbackApi;
  exports.internal = fallbackApi;
  exports.components = {};
}
`;

fs.writeFileSync(path.join(targetDir, 'api.js'), apiContent);
console.log('Converted and copied api.js to CommonJS');

// Convert ES module server.js to CommonJS if it exists
const serverPath = path.join(sourceDir, 'server.js');
if (fs.existsSync(serverPath)) {
  const serverContent = `/* eslint-disable */
/**
 * Generated server utility (converted to CommonJS for compatibility).
 */

const convexServer = require("convex/server");

Object.keys(convexServer).forEach(function(key) {
  if (key === "default" || key === "__esModule") return;
  exports[key] = convexServer[key];
});
`;
  fs.writeFileSync(path.join(targetDir, 'server.js'), serverContent);
  console.log('Converted and copied server.js to CommonJS');
}

// Copy TypeScript definition files as-is
const files = fs.readdirSync(sourceDir);
files.forEach(file => {
  if (file.endsWith('.d.ts')) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied ${file}`);
  }
});

console.log('Convex generated files processed successfully!');
