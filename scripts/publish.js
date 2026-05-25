const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

if (!process.env.GH_TOKEN) {
  console.error('GH_TOKEN not found in .env or environment');
  process.exit(1);
}

console.log('[publish] Building installer and publishing to GitHub...');
execSync('electron-builder --win --publish always', {
  stdio: 'inherit',
  env: process.env,
});
console.log('[publish] Done!');
