/**
 * prune-backend.js
 * Remove arquivos desnecessários de build-resources/backend/node_modules
 * antes do empacotamento com electron-builder.
 *
 * Economia estimada: ~40 MB (de 142 MB para ~100 MB)
 */

const fs = require('fs');
const path = require('path');

const BUILD_NM_DIR = path.resolve(__dirname, '..', 'build-resources', 'backend', 'node_modules');
const BACKEND_NM_DIR = path.resolve(__dirname, '..', 'backend', 'node_modules');

function log(msg) {
  console.log(`[prune] ${msg}`);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
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

function getDirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let size = 0;
  const stat = fs.statSync(dir);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(dir)) {
      size += getDirSize(path.join(dir, entry));
    }
  } else {
    size = stat.size;
  }
  return size;
}

function prepareNodeModules() {
  const buildResourcesDir = path.resolve(__dirname, '..', 'build-resources', 'backend');

  // Sync package.json and package-lock.json from backend/
  for (const file of ['package.json', 'package-lock.json']) {
    const src = path.resolve(__dirname, '..', 'backend', file);
    const dest = path.join(buildResourcesDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      log(`Synced ${file}`);
    }
  }

  // Remove build-resources node_modules if it exists (may be stale)
  if (fs.existsSync(BUILD_NM_DIR)) {
    log('Removing old build-resources node_modules...');
    removeRecursive(BUILD_NM_DIR);
  }
  // Copy fresh from backend/node_modules
  log(`Copying backend/node_modules to build-resources...`);
  copyRecursive(BACKEND_NM_DIR, BUILD_NM_DIR);
  log('Copy complete.');
}

function prune() {
  if (!fs.existsSync(BUILD_NM_DIR)) {
    log('node_modules not found');
    return;
  }

  const beforeSize = getDirSize(BUILD_NM_DIR);
  let removedSize = 0;

  // 1. Remove @types/* — TypeScript types não são necessários em runtime
  const typesDir = path.join(BUILD_NM_DIR, '@types');
  if (fs.existsSync(typesDir)) {
    for (const entry of fs.readdirSync(typesDir)) {
      const p = path.join(typesDir, entry);
      removedSize += removeRecursive(p);
      log(`Removed @types/${entry}`);
    }
  }

  // 2. Remove sharp e @img/* — não é usado no código
  for (const dir of ['sharp', '@img']) {
    const p = path.join(BUILD_NM_DIR, dir);
    if (fs.existsSync(p)) {
      removedSize += removeRecursive(p);
      log(`Removed ${dir}/`);
    }
  }

  // 3. Remove diretórios de testes, docs, exemplos
  const DIRS_TO_REMOVE = [
    'test', 'tests', '__tests__', 'spec',
    'example', 'examples',
    'doc', 'docs',
    '.github', '.eslintrc', '.eslintrc.js', '.eslintrc.json',
    '.prettierrc', '.prettierrc.js', '.prettierrc.json',
    '.editorconfig', '.npmignore', '.gitignore',
    '.nyc_output', 'coverage',
  ];

  function pruneDirs(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);

      // Handle scoped packages (@scope/name)
      if (entry.startsWith('@') && fs.statSync(full).isDirectory()) {
        for (const subEntry of fs.readdirSync(full)) {
          const subFull = path.join(full, subEntry);
          pruneDirs(subFull);
        }
        // Remove empty scope dir
        if (fs.readdirSync(full).length === 0) {
          fs.rmdirSync(full);
        }
        continue;
      }

      if (fs.statSync(full).isDirectory()) {
        if (DIRS_TO_REMOVE.includes(entry)) {
          removedSize += removeRecursive(full);
        } else {
          // Recurse into subdirectories
          pruneDirs(full);
        }
      }
    }
  }

  pruneDirs(BUILD_NM_DIR);
  log('Removed test/docs/example directories');

  // 4. Remove arquivos desnecessários em cada package
  const FILES_TO_REMOVE = [
    '*.map',
    '*.ts',
    '*.tsx',
    '*.flow',
    'CHANGELOG*',
    'CHANGES*',
    'HISTORY*',
    'LICENSE*',
    'LICENCE*',
    'CONTRIBUTORS*',
    'AUTHORS*',
    '.DS_Store',
    'Thumbs.db',
    '*.tgz',
  ];

  function matchesPattern(filename, patterns) {
    for (const pattern of patterns) {
      if (pattern.startsWith('*')) {
        const ext = pattern.slice(1);
        if (filename.endsWith(ext)) return true;
      }
      if (filename === pattern || filename.startsWith(pattern.replace('*', ''))) {
        return true;
      }
    }
    return false;
  }

  function pruneFiles(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        pruneFiles(full);
      } else if (matchesPattern(entry, FILES_TO_REMOVE)) {
        removedSize += stat.size;
        fs.unlinkSync(full);
      }
    }
  }

  // Only prune inside package directories, not the root
  for (const entry of fs.readdirSync(BUILD_NM_DIR)) {
    const full = path.join(BUILD_NM_DIR, entry);
    if (!fs.statSync(full).isDirectory()) continue;

    if (entry.startsWith('@')) {
      // Scoped package
      for (const subEntry of fs.readdirSync(full)) {
        pruneFiles(path.join(full, subEntry));
      }
    } else {
      pruneFiles(full);
    }
  }
  log('Removed unnecessary files (*.map, *.ts, changelogs, etc.)');

  const afterSize = getDirSize(BUILD_NM_DIR);
  const savedMB = (removedSize / (1024 * 1024)).toFixed(1);
  const afterMB = (afterSize / (1024 * 1024)).toFixed(1);
  const beforeMB = (beforeSize / (1024 * 1024)).toFixed(1);
  log(`Done! ${beforeMB} MB -> ${afterMB} MB (saved ${savedMB} MB)`);
}

prepareNodeModules();
prune();
