# License Server

Servidor central de licenças para o sistema de delivery. Gerencia clientes, planos, licenças e ativações.

## Stack

- **Backend:** Node.js + Express + TypeScript
- **Banco:** MySQL 8
- **Frontend admin:** React + Vite + Tailwind
- **Deploy:** Docker Compose (recomendado) ou PM2

---

## Deploy com Docker (recomendado)

### Requisitos

- [Docker](https://docs.docker.com/get-docker/) instalado no servidor

### Primeiro deploy

```bash
git clone <url-do-repo> license-server
cd license-server

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais (veja tabela abaixo)

# Subir tudo (MySQL + App)
docker compose up -d
```

Pronto. O MySQL cria o banco, as migrations rodam automaticamente, o seed cria o admin padrão, e o app sobe na porta 3400.

### Acessos

- **API:** `http://seu-ip:3400`
- **Admin panel:** `http://seu-ip:3400/admin`
- **Health check:** `http://seu-ip:3400/health`

### Comandos úteis

```bash
docker compose up -d              # Iniciar
docker compose down               # Parar tudo
docker compose restart app        # Reiniciar só o app
docker compose logs -f            # Ver logs (todos)
docker compose logs -f app        # Logs só do app
docker compose ps                 # Ver status dos containers
```

### Atualizar após mudanças

```bash
git pull
docker compose up -d --build
```

Os dados do MySQL são preservados entre rebuilds (volume `mysql_data`).

### Backup do banco

```bash
docker compose exec mysql mysqldump -uroot -pSUA_SENHA adega_licenses > backup.sql
```

### Restaurar backup

```bash
docker compose exec -T mysql mysql -uroot -pSUA_SENHA adega_licenses < backup.sql
```

---

## Variáveis de ambiente (.env)

| Variável | Descrição | Default |
|---|---|---|
| `PORT` | Porta da API | `3400` |
| `DB_PASSWORD` | Senha do MySQL | `lic3ns3_s3cur3` |
| `DB_NAME` | Nome do banco de dados | `adega_licenses` |
| `JWT_SECRET` | Secret para assinar tokens JWT | `change-this...` |
| `ADMIN_USERNAME` | Username do admin padrão | `admin` |
| `ADMIN_PASSWORD` | Senha do admin padrão | `admin123` |

**Em produção, altere pelo menos:** `DB_PASSWORD`, `JWT_SECRET` e `ADMIN_PASSWORD`.

---

## Arquitetura Docker

```
docker-compose.yml
├── app (Node.js + PM2, porta 3400)
│   └── Build multi-stage: admin frontend + backend compilado
└── mysql (MySQL 8, porta 3307 no host)
    └── Volume persistente: mysql_data
```

- **Entrypoint:** espera MySQL ficar pronto → roda migrations → roda seed → inicia PM2
- **MySQL** expõe porta 3307 no host (pra não conflitar com MySQL local)
- **PM2** roda 6 instâncias em cluster dentro do container
- **Volume** `mysql_data` garante que os dados sobrevivem rebuilds

---

## Deploy manual (sem Docker)

Para quem preferir rodar direto no VPS com PM2:

```bash
# Instalar dependências
npm install
cd admin && npm install && cd ..

# Configurar .env
cp .env.example .env

# Build
cd admin && npm run build && cd ..
npm run build

# Banco de dados
npm run migrate
npm run seed

# Iniciar com PM2
npm install -g pm2
npm run pm2:start
```

### Comandos PM2

```bash
npm run pm2:start    # Iniciar
npm run pm2:stop     # Parar
npm run pm2:restart  # Reiniciar
npm run pm2:logs     # Ver logs
```

---

## Estrutura do projeto

```
├── src/
│   ├── index.ts              # Entrypoint Express
│   ├── config/database.ts    # Pool de conexões MySQL
│   ├── database/
│   │   ├── migrate.ts        # Criação de tabelas
│   │   └── seed.ts           # Dados padrão (admin, plano mensal)
│   ├── middleware/            # JWT auth, validação Zod
│   ├── routes/               # Rotas da API
│   └── services/             # Lógica de negócio
├── admin/                    # Frontend React (Vite + Tailwind)
├── Dockerfile                # Multi-stage build
├── docker-compose.yml        # App + MySQL
├── docker-entrypoint.sh      # Setup automático do container
└── ecosystem.config.js       # Config PM2
```

## Rotas da API

### Admin (JWT obrigatório)
- `POST /api/auth/login` — Login
- `GET /api/clients` — Listar clientes
- `GET /api/plans` — Listar planos
- `GET /api/licenses` — Listar licenças
- `POST /api/licenses` — Criar licença
- `GET /api/stats` — Estatísticas do dashboard

### Cliente (sem JWT)
- `POST /api/client/auth/login` — Login do cliente
- `POST /api/client/licenses/activate` — Ativar licença
- `POST /api/client/licenses/validate` — Validar licença
