# Project: Painel Delivery (Adega)

Sistema de Delivery e PDV para adegas e estabelecimentos comerciais.

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Fastify + TypeScript + SQL.js (SQLite)
- **Desktop**: Electron
- **WhatsApp**: Baileys
- **Impressao**: node-thermal-printer

## Commands

- `npm run dev` (within `backend/`): Backend dev server
- `npm run dev` (within `frontend/`): Frontend dev server
- `npm run build`: Build all (backend + frontend + electron)
- `npm run build:backend`: Build backend only
- `npm run build:frontend`: Build frontend only
- `npx tsc --noEmit --project backend/tsconfig.json`: Typecheck backend
- `npm run migrate` (within `backend/`): Run database migrations
- `npm test` (within `backend/`): Run tests

## Key Architecture

- WhatsApp bot com dois modos: `nlp` (local) e `ai` (API externa mimo-v2.5-pro)
- Bot mode configurado em `backend/src/config/app.config.ts` (atualmente `nlp`)
- NLP service: `backend/src/services/nlp/nlp.service.ts` - parser local de mensagens
- AI service: `backend/src/services/ai/ai.service.ts` - interpretacao via API
- WhatsApp handler: `backend/src/modules/whatsapp/whatsapp.handler.ts` - fluxo de estados
- Session state machine: idle → awaiting_items → awaiting_name → awaiting_address → awaiting_payment → awaiting_notes → order_placed
- Banco de dados SQL.js (SQLite in-memory + file persistence em `data/`)
- Formatters: `backend/src/modules/whatsapp/whatsapp.formatter.ts`

## Conventions

- TypeScript estrito
- Sem comentarios no codigo salvo se solicitado
- Services ficam em `backend/src/services/`
- Modules (routes + service + model) em `backend/src/modules/`
- Migracoes em `backend/src/database/migrations/`
- Seeds em `backend/src/database/seeds/`
