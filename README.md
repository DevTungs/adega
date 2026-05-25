<<<<<<< HEAD
# Painel Delivery

Sistema completo de delivery para adegas, pizzerias e negocios similares. Desktop app (Electron) com backend Fastify, frontend React e painel administrativo web.

---

## Estrutura do Projeto

```
adega/
├── backend/          # API Fastify + SQLite (sql.js)
├── frontend/         # React + Vite + TailwindCSS
├── electron/         # Wrapper Electron (main process)
├── license-server/   # Servidor central de licencas (Express + MySQL)
│   └── admin/        # Painel admin do license-server (React)
├── build-resources/  # node_modules do backend para empacotamento Electron
├── release/          # Builds gerados pelo electron-builder
├── start.js          # Launcher de desenvolvimento (backend + frontend)
└── package.json      # Config do Electron e scripts globais
```

---

## Stack Tecnica

| Camada | Tecnologia |
|---|---|
| Desktop | Electron 34 |
| Backend API | Fastify + TypeScript |
| Banco de dados | SQLite via sql.js (WASM, em memoria com persistencia em disco) |
| Frontend | React 18 + Vite + TailwindCSS + Zustand |
| NLP | Fuse.js (busca fuzzy de produtos) |
| Impressao | ESC/POS via impressora termica |
| WhatsApp | Baileys (conexao direta) |
| Auto-update | electron-updater + GitHub Releases |
| License Server | Express + MySQL + TypeScript |

---

## Modulos do Backend

| Modulo | Descricao |
|---|---|
| `auth` | Autenticacao JWT |
| `orders` | Pedidos (balcao, delivery, retirada) |
| `products` | Produtos e estoque |
| `categories` | Categorias de produtos |
| `customers` | Cadastro de clientes |
| `coupons` | Cupons de desconto |
| `promotions` | Promocoes |
| `delivery` | Configuracoes de entrega (taxa, minimo, raio) |
| `settings` | Configuracoes do sistema |
| `whatsapp` | Integracao WhatsApp (atendimento automatico via IA) |
| `license` | Validacao de licenca (comunicacao com license-server) |
| `reports` | Relatorios de vendas |

## Paginas do Frontend

| Pagina | Rota |
|---|---|
| Dashboard | `/` |
| Pedidos | `/orders` |
| Produtos | `/products` |
| Categorias | `/categories` |
| Clientes | `/customers` |
| WhatsApp | `/whatsapp` |
| Mensagens | `/messages` |
| Configuracoes | `/settings` |
| Licenca | `/license` |
| Login | `/login` |

---

## Requisitos

- Node.js 18+ (recomendado: 22+)
- npm
- Windows 10/11 (build Electron e impressora termica)

---

## Instalacao e Desenvolvimento

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/Kevick/adega.git
cd adega
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Configurar variaveis de ambiente

Copie o `.env.example` do backend (ou crie manualmente):

```env
PORT=3333
HOST=0.0.0.0
NODE_ENV=development
JWT_SECRET=sua_chave_secreta_aqui
LICENSE_SERVER_URL=https://seu-license-server.com
LICENSE_API_KEY=sua_api_key
```

### 3. Rodar em desenvolvimento

```bash
npm start
```

Isso executa `start.js` que dispara o backend (`npm run dev`) e o frontend (`npm run dev`) simultaneamente. O backend roda na porta 3333 e o frontend na 5173 com proxy automatico.

### 4. Rodar Electron em desenvolvimento

```bash
npm run electron:dev
```

Abre o Electron apontando pro Vite dev server (porta 5173).

---

## Build e Empacotamento

### Build local (sem publicar)

```bash
npm run build:all
```

Gera o instalador `.exe` em `release/`.

### Build e publicar no GitHub Releases

```bash
npm run publish
```

Compila backend, frontend e empacota o Electron. Publica automaticamente no GitHub Releases configurado no `package.json`.

### Scripts disponiveis

| Script | Descricao |
|---|---|
| `npm start` | Dev mode (backend + frontend via start.js) |
| `npm run electron:dev` | Electron em dev mode (conecta ao Vite) |
| `npm run electron:start` | Electron com build de producao |
| `npm run build:backend` | Compila o TypeScript do backend |
| `npm run build:frontend` | Build do frontend com Vite |
| `npm run build:all` | Build completo + instalador Electron |
| `npm run publish` | Build completo + publica no GitHub Releases |

---

## Auto-Update (Atualizacoes Automaticas)

O app usa `electron-updater` com GitHub Releases para atualizacoes automaticas.

### Como funciona

1. Ao abrir o app, apos 10 segundos, checa se ha atualizacoes no GitHub Releases
2. Se houver, baixa automaticamente em background
3. Um toast mostra o progresso do download
4. Quando termina, exibe "Reiniciar agora?" com botao para aplicar
5. O update e incremental (delta) — so baixa o que mudou

### Configuracao

No `package.json`, secao `build.publish`:

```json
"publish": [{
  "provider": "github",
  "owner": "Kevick",
  "repo": "adega"
}]
```

### Para publicar uma atualizacao

1. Atualize a versao no `package.json` (`version`)
2. Rode `npm run publish`
3. O electron-builder cria uma release no GitHub com os artifacts
4. Clientes com versao anterior detectam e atualizam automaticamente

---

## License Server

O license-server e um servico separado que gerencia licencas dos clientes. Roda em MySQL.

### Estrutura

```
license-server/
├── src/
│   ├── routes/
│   │   ├── auth.routes.ts         # Login admin
│   │   ├── client.routes.ts       # CRUD de clientes
│   │   ├── license.routes.ts      # CRUD + bloquear/desbloquear/excluir licencas
│   │   ├── plan.routes.ts         # CRUD de planos
│   │   ├── client-license.routes.ts # Ativacao/validacao de licencas (chamado pelo app)
│   │   └── stats.routes.ts        # Estatisticas
│   ├── services/
│   │   └── license.service.ts     # Logica de validacao de licencas
│   └── database/
│       └── migrate.ts             # Migrations MySQL
└── admin/                         # Painel admin (React + Vite)
    └── src/pages/
        ├── Dashboard.tsx          # Visao geral
        ├── Clients.tsx            # Gerenciar clientes
        ├── Licenses.tsx           # Gerenciar licencas
        ├── LicenseDetail.tsx      # Detalhes + historico de ativacoes
        ├── Plans.tsx              # Gerenciar planos
        └── Login.tsx              # Login admin
```

### Acoes disponiveis no admin

| Acao | Descricao |
|---|---|
| Criar licenca | Gera chave vinculada a cliente + plano |
| Renovar | Estende a data de vencimento |
| Bloquear | Impede uso da licenca |
| Desbloquear | Reativa licenca bloqueada |
| Excluir | Remove licenca e historico de ativacoes |
| Excluir cliente | Desativa cliente e bloqueia licencas ativas |

### Ambiente do License Server

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=license_server
JWT_SECRET=sua_chave_admin
```

### Rodar license-server

```bash
cd license-server
npm install
npm run migrate    # Cria as tabelas no MySQL
npm run seed       # Dados iniciais (admin, planos)
npm run dev        # Dev mode com tsx watch
```

### Rodar o admin

```bash
cd license-server/admin
npm install
npm run dev        # Vite dev server
```

---

## Tabelas do Banco (Backend - SQLite)

| Tabela | Descricao |
|---|---|
| `users` | Usuarios do sistema |
| `categories` | Categorias de produtos |
| `products` | Produtos (nome, preco, estoque, imagem) |
| `customers` | Clientes (nome, telefone, endereco) |
| `orders` | Pedidos (tipo, status, total, endereco) |
| `order_items` | Itens do pedido |
| `settings` | Configuracoes do sistema (JSON) |
| `coupons` | Cupons de desconto |
| `promotions` | Promocoes |
| `licenses` | Licenca local (chave, status, validade, fingerprint) |
| `messages` | Historico de mensagens WhatsApp |

---

## Tabelas do License Server (MySQL)

| Tabela | Descricao |
|---|---|
| `admins` | Administradores do license-server |
| `clients` | Clientes (negocios que usam o sistema) |
| `plans` | Planos de licenca (duracao, preco, dias de graca) |
| `licenses` | Licencas geradas (chave, status, vencimento, fingerprint) |
| `license_activations` | Log de ativacoes/validacoes |

---

## Licenciamento

O sistema opera com licenca mensal controlada pelo license-server central:

- O app valida a licenca online a cada **30 minutos**
- Se o servidor nao responde, usa cache local (maximo **72h offline**)
- Licenca expirada: bloqueia criacao de novos pedidos
- Licenca bloqueada: acesso total restrito
- Dias de graca apos vencimento configuravel por plano
- Deteccao de adulteracao do SQLite local (HMAC)

---

## Seguranca

- JWT para autenticacao
- Rate limiting nas rotas da API
- CORS configurado para origens especificas
- SQLite com HMAC para deteccao de adulteracao
- Fingerprint da maquina para vincular licenca
- electron-updater com verificacao de assinatura desabilitada (configurar para producao)
- Context isolation no Electron (preload bridge)
- Navegacao bloqueada para URLs externas

---

## Licenca

Proprietario. Uso interno.
=======
# Adega Delivery

Sistema de delivery para adega com painel administrativo web, API backend e integração com WhatsApp.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind + Zustand
- Backend: Fastify + TypeScript + JWT + Zod
- Banco: SQLite (`sql.js`) com persistência em arquivo local
- Mensageria: Baileys (WhatsApp Web)

## Estrutura do Repositório

- `frontend/`: painel administrativo
- `backend/`: API, regras de negócio e integrações
- `DBVIEWER/`: binários do SQLiteStudio para inspeção local do banco
- `start.js`, `start.bat`, `setup.bat`: scripts de setup e execução em Windows

## Requisitos

- Node.js 22+
- Windows (scripts `.bat` e fluxo atual estão focados em Windows)

## Setup e Execução

1. Setup inicial:
```bash
setup.bat
```

2. Iniciar aplicação:
```bash
start.bat
```

3. Endereços padrão:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3333`

## Credenciais Iniciais (seed)

- Usuário: `admin`
- Senha: `admin123`

Altere imediatamente em ambiente real.

## Scripts Úteis

### Raiz
- `npm start`: inicia frontend + backend via `start.js`

### Backend
- `npm run dev`: modo desenvolvimento
- `npm run build`: build TypeScript
- `npm run start`: executa build
- `npm run migrate`: roda migrações
- `npm run seed`: popula dados iniciais

### Frontend
- `npm run dev`: desenvolvimento
- `npm run build`: build produção
- `npm run preview`: preview local da build

## Variáveis de Ambiente Relevantes (backend)

- `PORT` (default `3333`)
- `HOST` (default `0.0.0.0`)
- `FRONTEND_URL` (default `http://localhost:5173`)
- `JWT_SECRET` (default inseguro: `dev-secret`)
- `JWT_EXPIRES_IN` (default `7d`)
- `DB_PATH` (default `./data/adega.db`)
- `WA_SESSION_PATH` (default `./data/sessions`)
- `WA_MAX_RECONNECT` (default `10`)
- `LOG_LEVEL` (default `info`)
- `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` (integração de IA)

## Módulos Principais da API

- `auth`: login e perfil
- `orders`: pedidos e relatórios
- `products`: catálogo e estoque
- `categories`: categorias
- `customers`: clientes
- `whatsapp`: conexão/status/envio
- `settings`: configurações e impressoras

## Segurança

Foi gerado um relatório específico em:

- `VULNERABILIDADES.md`

>>>>>>> 8fd2372b3acc1e7677a0fe467b5bdf2d7f281f5a
