const { spawn } = require('child_process');
const path = require('path');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const logo = `
${C.green}${C.bold}
  +---------------------------+
  |   DELIVERY  SYSTEM  v1   |
  +---------------------------+
${C.reset}
${C.dim}  Sistema de Delivery${C.reset}
`;

function ts() {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false });
}

function log(tag, color, msg) {
  const lines = String(msg).split('\n').filter(l => l.trim());
  lines.forEach(line => {
    console.log(`${C.dim}${ts()}${C.reset} ${color}[${tag}]${C.reset} ${line}`);
  });
}

console.log(logo);
console.log(`${C.bold}Iniciando sistema...${C.reset}\n`);

const backend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'backend'),
  shell: true,
  stdio: ['pipe', 'pipe', 'pipe'],
});

const frontend = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'frontend'),
  shell: true,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let started = false;

function showReady() {
  if (started) return;
  started = true;

  console.log(`
${C.green}${C.bold}============================================================${C.reset}
${C.green}${C.bold}  Sistema rodando!${C.reset}

  ${C.bold}Backend:${C.reset}   ${C.green}http://localhost:3333${C.reset}
  ${C.bold}Frontend:${C.reset}  ${C.cyan}http://localhost:5173${C.reset}

  ${C.bold}Credenciais:${C.reset}
  ${C.dim}Usuario:${C.reset} admin
  ${C.dim}Senha:${C.reset}   admin123

  ${C.dim}Pressione Ctrl+C para parar o sistema${C.reset}
${C.green}${C.bold}============================================================${C.reset}
`);

  // Open browser
  try {
    require('child_process').exec('start "" http://localhost:5173');
  } catch (e) { /* ignore */ }
}

backend.stdout.on('data', d => log('BACKEND', C.green, d.toString()));
backend.stderr.on('data', d => {
  const s = d.toString();
  log('BACKEND', C.green, s);
  if (s.includes('Running at')) showReady();
});

frontend.stdout.on('data', d => {
  const s = d.toString();
  log('FRONTEND', C.cyan, s);
  if (s.includes('Local:') || s.includes('localhost:5173')) showReady();
});
frontend.stderr.on('data', d => log('FRONTEND', C.cyan, d.toString()));

// Auto-show after 8 seconds if not detected
setTimeout(showReady, 8000);

function cleanup() {
  console.log(`\n${C.yellow}Encerrando sistema...${C.reset}`);
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  backend.kill();
  frontend.kill();
});

backend.on('close', code => {
  if (code && code !== 0) log('BACKEND', C.red, `Encerrou com codigo ${code}`);
  frontend.kill();
  process.exit(code || 0);
});

frontend.on('close', code => {
  if (code && code !== 0) log('FRONTEND', C.red, `Encerrou com codigo ${code}`);
  backend.kill();
  process.exit(code || 0);
});
