const { execSync } = require('child_process');
const { version } = require('../package.json');

console.log(`[trigger-release] Triggering CI release for v${version}...`);
execSync(`gh workflow run Release --field version=v${version}`, {
  stdio: 'inherit',
});
console.log('[trigger-release] Workflow triggered! Check https://github.com/Kevick/adega/actions');
