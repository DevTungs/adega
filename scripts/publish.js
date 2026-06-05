const { execSync } = require('child_process');

console.log('[publish] Building installer and publishing to GitHub...');
execSync('electron-builder --win --publish always', {
  stdio: 'inherit',
  env: process.env,
});
console.log('[publish] Done!');
