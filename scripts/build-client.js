/**
 * Production webpack build for the client workspace.
 * Resolves webpack-cli from the client package (works with npm workspaces hoisting).
 */
const path = require('path');
const { spawnSync } = require('child_process');
const { createRequire } = require('module');

const repoRoot = path.join(__dirname, '..');
const clientRoot = path.join(repoRoot, 'client');
const clientRequire = createRequire(path.join(clientRoot, 'package.json'));
const cli = clientRequire.resolve('webpack-cli/bin/cli.js');

const result = spawnSync(process.execPath, [cli, '--mode', 'production'], {
  cwd: clientRoot,
  stdio: 'inherit',
});

process.exit(result.status === null ? 1 : result.status);
