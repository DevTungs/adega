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

