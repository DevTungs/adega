const { execSync } = require('child_process');
const os = require('os');

const platform = os.platform();
const buildFlag = platform === 'win32' ? '--win' : '--linux';

if (!process.env.GH_TOKEN) {
  console.error('[publish] GH_TOKEN environment variable is required');
  process.exit(1);
}

console.log(`[publish] Building ${platform} installer and publishing to GitHub...`);
execSync(`npx electron-builder ${buildFlag} --publish always`, {
  stdio: 'inherit',
  env: process.env,
});
console.log('[publish] Done!');
