# Relatório de Vulnerabilidades (Análise Estática)

Data da análise: 20/05/2026

## Resumo Executivo

- `npm audit --omit=dev` não apontou CVEs conhecidas nas dependências atuais (raiz, backend e frontend).
- Foram identificadas vulnerabilidades de configuração e controle de acesso no código.

## Achados

### 1. Credencial padrão fraca no seed (`CRÍTICO`)

- Evidência: `backend/src/database/seeds/001_initial_data.ts`
- Detalhe: usuário `admin` com senha `admin123` é criado automaticamente quando não existe admin.
- Impacto: takeover total do painel/API se a senha não for trocada.
- Recomendação:
  - Exigir troca de senha no primeiro login.
  - Remover senha hardcoded do seed e gerar senha inicial forte por variável de ambiente.
  - Bloquear login de credenciais padrão em produção.

### 2. Segredo JWT inseguro por fallback (`ALTO`)

- Evidência: `backend/src/server.ts`
- Detalhe: fallback `JWT_SECRET || 'dev-secret'`.
- Impacto: tokens podem ser forjados se a aplicação subir sem `JWT_SECRET` configurado.
- Recomendação:
  - Falhar startup quando `JWT_SECRET` não estiver definido em produção.
  - Usar segredo longo e rotacionável.

### 3. Exposição de QR/estado do WhatsApp sem autenticação (`ALTO`)

- Evidência: `backend/src/modules/whatsapp/whatsapp.routes.ts`
- Rota afetada: `GET /api/whatsapp/status` sem `authMiddleware`.
- Impacto: exposição do QR de pareamento e estado da conexão; risco de sequestro da sessão WhatsApp.
- Recomendação:
  - Proteger rota com autenticação/autorização.
  - Não retornar QR completo para perfis sem privilégio.
  - Adicionar trilha de auditoria de acessos a esta rota.

### 4. Leitura de configuração sem autenticação (`MÉDIO`)

- Evidência: `backend/src/modules/settings/settings.routes.ts`
- Rota afetada: `GET /api/settings/:key` sem `authMiddleware`.
- Impacto: vazamento de chaves sensíveis gravadas em `settings` (tokens, telefones, flags internas).
- Recomendação:
  - Exigir autenticação na rota.
  - Aplicar allowlist de chaves públicas.

### 5. Token JWT em `localStorage` (`MÉDIO`)

- Evidência: `frontend/src/stores/authStore.ts` e `frontend/src/api/client.ts`
- Detalhe: token persiste em `localStorage`.
- Impacto: em caso de XSS, token pode ser exfiltrado.
- Recomendação:
  - Preferir cookie `HttpOnly` + `Secure` + `SameSite`.
  - Endurecer CSP e sanitização de entradas dinâmicas.

## Observações

- O projeto usa queries parametrizadas para valores na maior parte das operações (`?` + params), o que reduz risco de SQL injection clássico.
- Existem endpoints públicos intencionais para catálogo (`/api/products`, `/api/categories`). Isso não é vulnerabilidade por si só, mas deve ser decisão explícita de negócio.

## Checklist de Correção Prioritária

1. Proteger `GET /api/whatsapp/status` com `authMiddleware`.
2. Proteger `GET /api/settings/:key` com `authMiddleware`.
3. Remover credencial default fixa (`admin/admin123`) e forçar troca inicial.
4. Tornar `JWT_SECRET` obrigatório em produção.
5. Planejar migração de token para cookie `HttpOnly`.

