/**
 * filter-locales.js
 * Remove arquivos de locale desnecessarios do build do Electron.
 * Mantem apenas en-US.pak e pt-BR.pak.
 *
 * Economia: ~40 MB (descompactado), ~5-8 MB (comprimido)
 */

const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log(`[locales] ${msg}`);
}

function removeRecursive(dir) {
  if (!fs.existsSync(dir)) return 0;
  let size = 0;
  const stat = fs.statSync(dir);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(dir)) {
      size += removeRecursive(path.join(dir, entry));
    }
    fs.rmdirSync(dir);
  } else {
    size = stat.size;
    fs.unlinkSync(dir);
  }
  return size;
}

// Called by electron-builder afterPack hook
module.exports = async function afterPack(context) {
  const localesDir = path.join(context.appOutDir, 'locales');

  if (!fs.existsSync(localesDir)) {
    log('locales directory not found, skipping');
    return;
  }

  const KEEP_LOCALES = ['en-US.pak', 'pt-BR.pak'];

  const files = fs.readdirSync(localesDir);
  let removed = 0;

  for (const file of files) {
    if (!KEEP_LOCALES.includes(file)) {
      removed += removeRecursive(path.join(localesDir, file));
    }
  }

  const kept = files.filter(f => KEEP_LOCALES.includes(f));
  const savedMB = (removed / (1024 * 1024)).toFixed(1);
  log(`Removed ${files.length - kept.length} locales, kept: ${kept.join(', ')}`);
  log(`Saved ${savedMB} MB`);
};
