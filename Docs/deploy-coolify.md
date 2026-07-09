# Deploy no Coolify — SGDCF

> **Versão:** 1.0 · Atualizado em: jun/2026
> ⚠️ **Documento de referência do projeto SGDCF.** Este guia documenta o deploy de outro projeto de estrutura similar. Não aplicável diretamente ao SGDE — consulte [`plano-deploy-coolify.md`](./plano-deploy-coolify.md) para o plano específico do SGDE.

Guia passo a passo para colocar o SGDCF em produção usando o Coolify self-hosted.

---

## Índice

- [Pré-requisitos](#pr%C3%A9-requisitos)
- [Estrutura do Deploy](#estrutura-do-deploy)
- [Opção A — Dockerfile (recomendado para Coolify)](#op%C3%A7%C3%A3o-a--dockerfile-recomendado-para-coolify)
- [Opção B — Docker Compose (multiserviço)](#op%C3%A7%C3%A3o-b--docker-compose-multiservi%C3%A7o)
- [Ciclo de Vida de Mudanças](#ciclo-de-vida-de-mudan%C3%A7as)
  - [Frontend/API — sem schema novo](#frontendapi--sem-altera%C3%A7%C3%A3o-de-schema)
  - [Schema do BD — novas migrations](#schema-do-bd--novas-migrations)
  - [Primeiro deploy + usuário admin](#primeiro-deploy--cria%C3%A7%C3%A3o-do-admin)
- [Variáveis de Ambiente](#vari%C3%A1veis-de-ambiente)
- [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

| Item | Observação |
|---|---|
| Coolify self-hosted rodando | v4+ recomendada |
| Domínio configurado (ex: `sgdcf.empresa.com`) | Coolify gerencia SSL via Let's Encrypt (Traefik/Caddy) |
| PostgreSQL 16 | Pode ser gerenciado pelo Coolify ou externo |
| Repositório Git | GitHub, GitLab, Gitea — Coolify faz deploy por push |
| Portas liberadas no firewall | 80/443 para o proxy reverso do Coolify |

---

## Estrutura do Deploy

O SGDCF é uma aplicação Next.js **standalone** (compilada em `server.js`) que roda em container Docker. O repositório contém:

| Recurso | Descrição |
|---|---|
| `Dockerfile` | Build multi-estágio + entrypoint com migrations automáticas |
| `scripts/docker-entrypoint.sh` | Bootstrap do container: gera Prisma Client → migrations → seed → start |
| `docker-compose.yml` | Orquestração completa (db + migrate + bootstrap + app) |
| `.env.production.example` | Template de variáveis de ambiente |
| `app/api/health/route.ts` | Endpoint de healthcheck (`/api/health`) |

---

## Opção A — Dockerfile (recomendado para Coolify)

Esta opção usa **apenas o Dockerfile**. O Coolify gerencia o banco separadamente.

### Passo 1 — Criar recurso PostgreSQL no Coolify

1. **Coolify → Databases → New → PostgreSQL**
2. Configurar:
   - **Name:** `sgdcf-db`
   - **Version:** `16` (alpine)
   - **Port:** `5432` (interna)
   - **User/Password:** anotar
3. **Deploy** e aguardar o status `running`

### Passo 2 — Criar aplicação

1. **Coolify → Applications → New → Dockerfile**
2. Configurar:
   - **Git Repository:** URL do seu repositório SGDCF
   - **Build Pack:** `Dockerfile` (nativo)
   - **Port:** `3000` (porta interna do Next.js — pode alterar via `PORT` nas env vars)
   - **Healthcheck:** Coolify detecta o `HEALTHCHECK` do Dockerfile. Opcional: configurar caminho HTTP `/api/health`

3. **Conectar banco de dados:**
   - **Databases → Connect to existing →** selecione o PostgreSQL criado
   - Coolify injeta automaticamente as variáveis de conexão no container

### Passo 3 — Variáveis de ambiente

Defina no Coolify **(Applications → SGDCF → Environment Variables)**:

```env
# Conexão com o banco (Coolify injeta automaticamente se conectado)
DATABASE_URL="postgresql://user:password@host:5432/sgdcf?schema=public"

# Sessions — troque por um valor REAL e seguro
#   Gere com: openssl rand -hex 64
SESSION_SECRET=""

# Fuso horário
APP_TIMEZONE=America/Manaus

# Migrations automáticas na inicialização
RUN_MIGRATIONS=true
```

> ⚠️ **Crucial:** `DATABASE_URL` é injetada automaticamente pelo Coolify quando você conecta o banco pela UI. Verifique se o nome do banco (`sgdcf`) coincide com o que foi criado.

### Passo 4 — Deploy inicial

1. Clique **Deploy**
2. Acompanhe os logs:
   - ✅ Docker build completo
   - ✅ Container iniciou
   - ✅ `[entrypoint] Aplicando migrations pendentes…` (ou "No pending migrations")
   - ✅ Healthcheck passando
3. Após o deploy, o app estará vivo mas **sem usuários**. Vá para [Primeiro deploy + criação do admin](#primeiro-deploy--criação-do-admin)

---

## Opção B — Docker Compose (multiserviço)

Para quem prefere que o Coolify gerencie o stack completo (incluindo banco). Use o `docker-compose.yml` do repositório.

### Passo 1 — Criar aplicação Docker Compose

1. **Coolify → Applications → New → Docker Compose**
2. **Git Repository:** URL do repositório
3. **Build Pack:** `docker-compose.yml`
4. Coolify detecta automaticamente os 4 serviços: `db`, `migrate`, `bootstrap`, `app`

### Passo 2 — Ajustar variáveis

No Coolify, defina:

```env
POSTGRES_USER=sgdcf_user
POSTGRES_PASSWORD=sua-senha-forte
SESSION_SECRET=openssl-rand-hex-64-aqui
APP_TIMEZONE=America/Manaus
APP_PORT=8080
PORT=3000
RUN_MIGRATIONS=true
```

### Passo 3 — Primeiro deploy

1. Faça o deploy
2. A ordem de inicialização é automática: `db → migrate → app`
3. O serviço `bootstrap` (seed) só roda sob demanda (profile `setup`). Para criar o admin, execute:

```bash
# Via terminal do Coolify no container sgdcf-bootstrap:
ALLOW_PRODUCTION_SEED=true SEED_ADMIN_PASSWORD=MinhaSenha pnpm db:seed
```

---

## Ciclo de Vida de Mudanças

### Frontend/API — sem alteração de schema

1. Faça `git push` no branch principal
2. Coolify detecta o push e inicia **redeploy automático**
3. A imagem Docker é reconstruída e o container substituído (zero downtime com proxy reverso)
4. **Não precisa rodar migrations** — schema não mudou

> ℹ️ Se quiser evitar redeploy automático, configure `Auto Deploy: Off` nas settings da aplicação no Coolify.

### Schema do BD — novas migrations

Quando você altera o `schema.prisma` e cria uma migration (`prisma migrate dev`):

1. Faça `git push` com o código novo + migration nova
2. Coolify inicia o redeploy
3. O entrypoint do container executa **automaticamente**:
   ```
   [entrypoint] Aplicando migrations pendentes…
   ```
4. Se houver migrations pendentes, `prisma migrate deploy` as aplica
5. Depois disso, o servidor Next.js inicia

**Se quiser desabilitar migrations automáticas** (ex: múltiplas réplicas, só a primeira roda):

```env
RUN_MIGRATIONS=false
```

Nesse caso, você roda manualmente via terminal do Coolify:

```bash
# Dentro do container em execução:
pnpm db:migrate
```

### Primeiro deploy / Criação do admin

O **seed** (`prisma/seed.ts`) cria o usuário `Admin` (SUPER_ADMIN), 2 empresas, 3 veículos e 3 funcionários.

**Proteção contra seed acidental em produção**:

O seed possui duas travas de segurança:
1. Bloqueado por padrão em `NODE_ENV=production` (`ALLOW_PRODUCTION_SEED=false`)
2. Em produção, exige `SEED_ADMIN_PASSWORD` obrigatória (nunca gera aleatória)

#### Fluxo correto para o primeiro deploy:

1. Faça o deploy inicial (app vai subir, mas sem usuários)
2. **Coolify → terminal do container** e execute:

```bash
# Define as variáveis e roda o seed
export ALLOW_PRODUCTION_SEED=true
export SEED_ADMIN_PASSWORD=MinhaSenhaSuperSegura123
pnpm db:seed
```

3. Confirme a saída:
   ```
   Seed concluído: 2 empresas, 3 veículos, 4 usuários
   ✅ Admin criado com SEED_ADMIN_PASSWORD. Remova ALLOW_PRODUCTION_SEED do .env agora.
   ```

4. **IMPORTANTE:** Remova `ALLOW_PRODUCTION_SEED` e `SEED_ADMIN_PASSWORD` das env vars no Coolify após o seed. Deixe `ALLOW_PRODUCTION_SEED=false`.

5. Faça login com usuário `Admin` e a senha definida.

6. **(Opcional)** Crie usuários adicionais pela interface administrativa.

> ⚠️ **Nunca rode o seed em produção novamente a menos que queira resetar os dados de seed.** As operações usam `upsert`, então rodar de novo atualizaria senhas.

---

## Variáveis de Ambiente

### Tabela completa

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `DATABASE_URL` | ✅ Sim | — | Conexão PostgreSQL (`postgresql://user:pass@host:5432/db?schema=public`) |
| `SESSION_SECRET` | ✅ Sim | — | Chave secreta JWT HS256. Gere com `openssl rand -hex 64` |
| `PORT` | ❌ Não | `3000` | Porta interna do servidor Next.js |
| `RUN_MIGRATIONS` | ❌ Não | `true` | Rodar `prisma migrate deploy` na inicialização |
| `ALLOW_PRODUCTION_SEED` | ❌ Não | `false` | Permitir seed em produção (use APENAS no primeiro deploy) |
| `SEED_ADMIN_PASSWORD` | 🟡 Condicional | — | Obrigatória se `ALLOW_PRODUCTION_SEED=true` em produção |
| `SEED_EMPLOYEE_PASSWORD` | ❌ Não | (aleatória) | Senha dos funcionários de seed |
| `APP_TIMEZONE` | ❌ Não | `America/Manaus` | IANA timezone do sistema |
| `CSRF_SECRET` | ❌ Não | — | Double-submit cookie CSRF (necessário se for usar rotas mutantes sem sessão) |

### Variáveis injetadas pelo Coolify (quando conecta o DB pela UI)

- `DATABASE_URL` — montada automaticamente
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, `POSTGRES_PORT`
- `S3_*` — se usar S3 para backups

---

## Troubleshooting

### App não inicia — erro de conexão com banco

**Sintoma:** Log: `Can't reach database server`

**Causa:** `DATABASE_URL` errada ou PostgreSQL não está acessível.

**Solução:**
1. Verifique se o banco está rodando: `pg_isready`
2. Confirme `DATABASE_URL` nas env vars do Coolify
3. Se o banco é externo, verifique se aceita conexão do IP do servidor Coolify (`pg_hba.conf`)

### Healthcheck falhando

**Sintoma:** Coolify marca container como unhealthy

**Solução:**
1. Aumente `start-period` se app demora para iniciar (seed + migrations)
2. Teste manualmente: `curl http://localhost:3000/api/health`
3. Verifique se `PORT` está correta nas env vars

### Seed não executa — "bloqueado em produção"

**Sintoma:** Log: `Seed bloqueado em produção`

**Causa:** Seed rodou sem `ALLOW_PRODUCTION_SEED=true`

**Solução:** Defina `ALLOW_PRODUCTION_SEED=true` e `SEED_ADMIN_PASSWORD` no terminal do container, não nas env vars permanentes. Execute apenas no primeiro deploy.

### Cookie de sessão não funciona

**Sintoma:** Login bem-sucedido mas redirect volta para login

**Causa:** Cookie com `secure=true` em HTTP (sem HTTPS). O Coolify usa HTTPS via proxy reverso, mas a conexão entre proxy e container é HTTP.

**Solução:** Nenhuma — é o comportamento correto. O `secure` verifica a conexão original (proxy → browser), não a conexão interna (proxy → container). Certifique-se de que o Coolify está servindo o domínio com HTTPS.

### App lento após deploy com migrations

**Sintoma:** Primeiro request demora ~30s

**Causa:** `start-period` do HEALTHCHECK + execução de migrations no entrypoint.

**Solução:** Comportamento normal. Configure o `start-period` do HEALTHCHECK no Dockerfile para 30s (já configurado). Após o bootstrap inicial, reinícios subsequentes serão rápidos (migrations só rodam se houver pendentes).

### ERR_PNPM_IGNORED_BUILDS durante o build

**Sintoma:** Log: `Ignored build scripts: @prisma/client, @prisma/engines, esbuild, prisma, sharp, unrs-resolver`

**Causa:** pnpm 11.5+ bloqueia build scripts por padrão.

**Solução:** O `pnpm-workspace.yaml` do projeto já contém `allowBuilds: true` e `onlyBuiltDependencies` com todos os pacotes necessários. Se este erro aparecer em um clone novo, execute `pnpm db:generate` localmente antes do primeiro deploy para garantir que o Prisma Client está gerado.

---

## Referências

- [README.md](../README.md) — índice da documentação do projeto
- [sgdcf-negocio.md](../sgdcf-negocio.md) — regras de negócio
- [.env.production.example](../../.env.production.example) — template de variáveis
- [Dockerfile](../../Dockerfile) — build do container
- [docker-compose.yml](../../docker-compose.yml) — orquestração completa