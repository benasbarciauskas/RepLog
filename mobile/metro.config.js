const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { resolve } = require('metro-resolver');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(projectRoot, 'core');
const mobileSrcRoot = path.resolve(projectRoot, 'src');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

const defaultResolveRequest = config.resolver.resolveRequest;

function resolveSourceFile(basePath) {
  const fileCandidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
  ];

  for (const filePath of fileCandidates) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }

  const indexCandidates = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];
  for (const indexName of indexCandidates) {
    const filePath = path.join(basePath, indexName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@core/')) {
    const filePath = resolveSourceFile(
      path.resolve(sharedRoot, moduleName.slice('@core/'.length)),
    );
    if (filePath) {
      return { type: 'sourceFile', filePath };
    }
  }

  if (moduleName.startsWith('@/')) {
    const origin = context.originModulePath ?? '';
    const roots = origin.startsWith(sharedRoot)
      ? [sharedRoot]
      : [mobileSrcRoot, sharedRoot];

    for (const root of roots) {
      const filePath = resolveSourceFile(path.resolve(root, moduleName.slice(2)));
      if (filePath) {
        return { type: 'sourceFile', filePath };
      }
    }
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return resolve(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });