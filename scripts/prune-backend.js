/**
 * prune-backend.js
 * Instala apenas production deps em build-resources/backend/
 * e remove arquivos desnecessarios restantes.
 *
 * Abordagem: npm install --omit=dev (muito mais eficiente que copiar e podar)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.resolve(__dirname, '..', 'build-resources', 'backend');
const BACKEND_DIR = path.resolve(__dirname, '..', 'backend');
const BUILD_NM_DIR = path.join(BUILD_DIR, 'node_modules');

function log(msg) {
  console.log(`[prune] ${msg}`);
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

function removeGlob(dir, patterns) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      removed += removeGlob(full, patterns);
    } else if (patterns.some(p => {
      if (p.startsWith('*')) return entry.endsWith(p.slice(1));
      return entry === p;
    })) {
      removed += stat.size;
      fs.unlinkSync(full);
    }
  }
  return removed;
}

function cleanPackageJson() {
  const pkgPath = path.join(BUILD_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Remove scripts, devDependencies, and metadata
  delete pkg.devDependencies;
  delete pkg.scripts;
  delete pkg.description;
  delete pkg.readme;
  delete pkg._resolved;
  delete pkg._integrity;
  delete pkg._from;

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  log('Cleaned package.json (removed devDependencies, scripts, metadata)');
}

function pruneRemainingFiles() {
  let removed = 0;

  // Remove common unnecessary files across all packages
  removed += removeGlob(BUILD_NM_DIR, [
    '*.map', '*.ts', '*.tsx', '*.flow',
    'CHANGELOG*', 'CHANGES*', 'HISTORY*',
    'LICENSE*', 'LICENCE*',
    'CONTRIBUTORS*', 'AUTHORS*',
    '.DS_Store', 'Thumbs.db', '*.tgz',
    '*.md', '*.mjs.map',
  ]);

  // Remove test/docs/examples directories
  const DIRS_TO_REMOVE = [
    'test', 'tests', '__tests__', 'spec',
    'example', 'examples',
    'doc', 'docs',
    '.github', '.eslintrc', '.eslintrc.js', '.eslintrc.json',
    '.prettierrc', '.prettierrc.js', '.prettierrc.json',
    '.editorconfig', '.npmignore', '.gitignore',
    '.nyc_output', 'coverage', 'benchmark', 'benchmarks',
  ];

  function pruneDirs(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (!stat.isDirectory()) continue;

      if (entry.startsWith('@')) {
        for (const subEntry of fs.readdirSync(full)) {
          const subFull = path.join(full, subEntry);
          if (fs.statSync(subFull).isDirectory()) {
            if (DIRS_TO_REMOVE.includes(subEntry)) {
              removed += removeRecursive(subFull);
            } else {
              pruneDirs(subFull);
            }
          }
        }
        if (fs.readdirSync(full).length === 0) {
          fs.rmdirSync(full);
        }
      } else if (DIRS_TO_REMOVE.includes(entry)) {
        removed += removeRecursive(full);
      } else {
        pruneDirs(full);
      }
    }
  }

  pruneDirs(BUILD_NM_DIR);

  // Remove @types entirely (TypeScript types not needed at runtime)
  const typesDir = path.join(BUILD_NM_DIR, '@types');
  if (fs.existsSync(typesDir)) {
    removed += removeRecursive(typesDir);
    log('Removed @types/ directory');
  }

  return removed;
}

async function main() {
  log('=== Backend Production Build ===');

  // Ensure build-resources/backend exists
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  // Remove old node_modules
  if (fs.existsSync(BUILD_NM_DIR)) {
    log('Removing old node_modules...');
    removeRecursive(BUILD_NM_DIR);
  }

  // Copy package.json (without devDependencies)
  const backendPkg = JSON.parse(fs.readFileSync(path.join(BACKEND_DIR, 'package.json'), 'utf8'));
  delete backendPkg.devDependencies;
  delete backendPkg.scripts;
  fs.writeFileSync(path.join(BUILD_DIR, 'package.json'), JSON.stringify(backendPkg, null, 2));
  log('Wrote clean package.json (no devDependencies)');

  // Also copy package-lock.json if it exists for reproducible installs
  const lockPath = path.join(BACKEND_DIR, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    fs.copyFileSync(lockPath, path.join(BUILD_DIR, 'package-lock.json'));
    log('Copied package-lock.json');
  }

  // Install production dependencies only
  log('Installing production dependencies (npm install --omit=dev)...');
  const originalSize = getDirSize(path.join(BACKEND_DIR, 'node_modules'));

  try {
    execSync('npm install --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error', {
      cwd: BUILD_DIR,
      stdio: 'inherit',
      timeout: 120000,
    });
  } catch (err) {
    log('npm install failed, falling back to copy-and-prune method');
    fallbackCopyAndPrune();
    return;
  }

  // Post-install cleanup
  const afterInstallSize = getDirSize(BUILD_NM_DIR);
  const savedFromInstall = ((originalSize - afterInstallSize) / (1024 * 1024)).toFixed(1);
  log(`Production deps: ${(afterInstallSize / (1024 * 1024)).toFixed(1)} MB (was ${(originalSize / (1024 * 1024)).toFixed(1)} MB, saved ${savedFromInstall} MB)`);

  // Clean package.json
  cleanPackageJson();

  // Remove remaining unnecessary files
  log('Cleaning up remaining unnecessary files...');
  const removedFiles = pruneRemainingFiles();

  const finalSize = getDirSize(BUILD_NM_DIR);
  const finalMB = (finalSize / (1024 * 1024)).toFixed(1);
  const savedMB = (removedFiles / (1024 * 1024)).toFixed(1);
  log(`File cleanup saved ${savedMB} MB`);
  log(`Final node_modules: ${finalMB} MB`);
  log('=== Done ===');
}

function fallbackCopyAndPrune() {
  // Fallback: copy all and prune (original method)
  log('Using fallback copy-and-prune method...');

  const BACKEND_NM = path.join(BACKEND_DIR, 'node_modules');
  if (!fs.existsSync(BACKEND_NM)) {
    log('ERROR: backend/node_modules not found');
    return;
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

  copyRecursive(BACKEND_NM, BUILD_NM_DIR);
  cleanPackageJson();
  const removed = pruneRemainingFiles();
  const finalSize = getDirSize(BUILD_NM_DIR);
  log(`Fallback result: ${(finalSize / (1024 * 1024)).toFixed(1)} MB`);
}

main();
