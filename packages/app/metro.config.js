const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the whole repo so Metro picks up changes in workspace packages.
// SDK 54 expo/metro-config sets defaults that already include projectRoot — append.
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), monorepoRoot]));

// Resolve packages from the app's local node_modules first, then the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Allow inline-import of generated drizzle migration .sql files.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'sql'];

module.exports = config;
