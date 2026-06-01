const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const GH_TOKEN = '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';
process.env.GH_TOKEN = GH_TOKEN;

console.log('[publish] Building installer and publishing to GitHub...');
execSync('electron-builder --win --publish always', {
  stdio: 'inherit',
  env: process.env,
});
console.log('[publish] Done!');
