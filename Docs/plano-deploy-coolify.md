# Plano de Deploy no Coolify — SGDE

> **Versão:** 1.0 · Atualizado em: jul/2026
> **Contexto:** Migração do app do Portainer para o Coolify, mantendo o BD no Portainer.

Plano completo para migrar apenas a aplicação SGDE do Portainer para o Coolify. O PostgreSQL continua no Portainer (VM separada no Proxmox, conectada via bridge privada isolada da internet).

---

## Índice

- [Visão Geral](#visão-geral)
- [Premissas e Topologia](#premissas-e-topologia)
- [Parte 1 — Ações no Portainer (BD)](#parte-1--ações-no-portainer-bd)
- [Parte 2 — Ações no Coolify (App)](#parte-2--ações-no-coolify-app)
- [Parte 3 — Alterações no Projeto (para outro agente de IA)](#parte-3--alterações-no-projeto-para-outro-agente-de-ia)
- [Ordem de Execução Consolidada](#ordem-de-execução-consolidada)
- [Troubleshooting](#troubleshooting)

---

## Visão Geral

| Item | Decisão |
|---|---|
| O que migra pro Coolify | Apenas a aplicação Next.js (serviço `app`) |
| O que fica no Portainer | Apenas o PostgreSQL (serviço `db`) |
| Conexão app → BD | Via rede interna do Proxmox (bridge privada, sem rota pra internet) |
| Deploy no Coolify | Via `Dockerfile` nativo (não via `docker-compose.yml`) |
| Migrations | Manuais no 1º deploy; automáticas após implementar a Parte 3 |
| Risco de segurança | Baixo — BD acessível só na bridge privada + senha forte |

---

## Premissas e Topologia

```
┌─────────────────────────────────────────────────────┐
│                     Proxmox Host                     │
│                                                      │
│  ┌──────────────────┐    ┌──────────────────────┐   │
│  │  VM Portainer    │    │  VM Coolify          │   │
│  │                  │    │                      │   │
│  │  ┌────────────┐  │    │  ┌────────────────┐  │   │
│  │  │ PostgreSQL │  │    │  │  App Next.js   │  │   │
│  │  │  :5432     │◄┼────┼──┤  DATABASE_URL ──┘  │   │
│  │  └────────────┘  │    │  └────────────────┘  │   │
│  └────────┬─────────┘    └──────────┬───────────┘   │
│           │                         │                │
│           └───────── vmbr1 (bridge privada) ─────────┘
│                  10.x.x.x/24 (sem rota pra internet)  │
└─────────────────────────────────────────────────────┘
```

**Premissas confirmadas:**

1. As VMs Portainer e Coolify estão em VMs separadas no Proxmox.
2. Existe uma **bridge privada** (`vmbr1` ou similar) conectando as VMs, **sem rota pra internet** (Cenário 1 — seguro).
3. O BD atual roda sem porta exposta (acessível só pela network do compose).
4. A senha atual do postgres é `postgres:postgres` (fraca — será trocada).

**IPs de referência (substitua pelos reais):**

| VM | IP na bridge privada | Função |
|---|---|---|
| VM Portainer | `10.0.0.5` | Hospeda o PostgreSQL |
| VM Coolify | `10.0.0.6` | Hospeda o app Next.js |

---

## Parte 1 — Ações no Portainer (BD)

### 1.1 — Trocar a senha do PostgreSQL

> ⚠️ **Gotcha crítico:** A variável `POSTGRES_PASSWORD` do compose **só é lida na 1ª inicialização** (quando o volume está vazio). Como o BD já está em produção com dados no volume `sgde_pgdata`, alterar a env var **NÃO troca a senha**. É preciso usar `ALTER USER` dentro do postgres.

**Passo 1 — Gerar uma senha forte** (no terminal da VM Portainer):

```bash
openssl rand -hex 24
# anote o resultado — será a nova senha do postgres
```

> Use `hex` (não `base64`) para evitar caracteres que quebram URL (`+`, `/`, `=`).

**Passo 2 — Trocar a senha dentro do postgres:**

```bash
# Conectar no container do BD
docker exec -it sgde-db psql -U postgres -d sgde

# Dentro do psql, executar:
ALTER USER postgres WITH PASSWORD 'SENHA_HEX_GERADA_AQUI';
\q
```

A senha nova entra em vigor **imediatamente** — não precisa reiniciar o postgres.

**Passo 3 — Guardar a senha nova em local SEGURO (nunca no compose commitado):**

> ⚠️ **Segurança:** O `docker-compose.yml` é versionado no Git. **Nunca hardcodeie a senha nele** — isso vaza credenciais pro repositório. A senha real deve ficar em um arquivo `.env` no servidor (gitignored) ou na UI do Portainer.

Embora o postgres ignore a env var `POSTGRES_PASSWORD` em volume existente, é preciso manter essa var definida (igual à senha nova) para o `pg_isready` do healthcheck funcionar com a senha correta, e para o caso de um dia precisar recriar o volume.

**Onde colocar a senha real (escolha UMA das opções):**

**Opção A — Arquivo `.env` na VM Portainer (recomendado):**

Crie um arquivo `.env` **no mesmo diretório do compose, na VM Portainer** (não no repositório Git):

```env
# /caminho/no/servidor/sgde/.env  (na VM Portainer — NUNCA commitado)
POSTGRES_PASSWORD=SENHA_HEX_GERADA_AQUI
DB_BIND_IP=10.0.0.5
```

O Docker Compose lê `.env` automaticamente. Como o `.gitignore` do projeto já ignora `.env`, esse arquivo nunca vai pro repositório.

**Opção B — Variáveis de ambiente na UI do Portainer:**

Ao editar o stack no Portainer, há um campo "Environment variables" na interface. Defina `POSTGRES_PASSWORD` e `DB_BIND_IP` lá — ficam armazenadas no Portainer, não no compose.

> O compose (Parte 1.2) usará a sintaxe `${POSTGRES_PASSWORD:?...}` para **referenciar** essa variável, sem conter a senha em si.

### 1.2 — Expor a porta do BD na bridge privada

Editar o `docker-compose.yml` no Portainer para **manter apenas o serviço `db`** e expor a porta bindada no IP interno da VM:

```yaml
# docker-compose.yml no Portainer (apenas BD)
# ⚠️ A senha NÃO fica aqui — vem do .env da VM Portainer ou da UI do Portainer.
services:
  db:
    image: postgres:16-alpine
    container_name: sgde-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: sgde
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?definir-no-.env-ou-UI}   # <-- referencia, não hardcodeia
    ports:
      - "${DB_BIND_IP:-10.0.0.5}:5432:5432"   # <-- bind no IP interno, NUNCA 0.0.0.0
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d sgde"]
      interval: 5s
      timeout: 3s
      retries: 20
    volumes:
      - sgde_pgdata:/var/lib/postgresql/data

volumes:
  sgde_pgdata:
```

**Pontos de atenção:**

| Item | Por quê |
|---|---|
| `${POSTGRES_PASSWORD:?...}` | Referencia a env var definida no `.env` da VM ou na UI do Portainer. A sintaxe `:?msg` **obriga** a definição — se a var não existir, o compose recusa iniciar (erro explícito em vez de rodar com senha vazia). O compose pode ser commitado sem risco. |
| `${DB_BIND_IP:-10.0.0.5}` | IP interno da VM Portainer na bridge privada. Default `10.0.0.5` se a var não estiver definida. |
| `10.0.0.5:5432:5432` (IP interno) | Binda só na interface da bridge privada. **Nunca use `0.0.0.0`** — exporia pra todas as interfaces, inclusive a que tem rota pra internet. |
| Remover serviços `migrate`, `bootstrap`, `app` | Eles vão pro Coolify (Parte 2). O compose do Portainer fica só com o BD. |
| Manter o volume `sgde_pgdata` | Preserva os dados existentes. Não recriar o volume. |

**Aplicar as mudanças:**

```bash
# No host da VM Portainer
docker compose up -d db
```

> O container `sgde-db` será recriado com a nova config de portas, mas o volume é preservado (dados intactos).

### 1.3 — Verificar conectividade

A partir da VM Coolify, testar se consegue chegar no BD:

```bash
# Na VM Coolify (não no container)
psql -h 10.0.0.5 -U postgres -d sgde -c "SELECT 1;"
# digite a senha nova quando solicitado
```

Se retornar `1`, a conexão está OK. Se falhar, verifique:

- Se a bridge privada do Proxmox está conectando as 2 VMs
- Se o IP `10.0.0.5` é o correto da VM Portainer nessa bridge
- Se o container `sgde-db` subeu com a porta mapeada (`docker ps` na VM Portainer)

---

## Parte 2 — Ações no Coolify (App)

### 2.1 — Criar a aplicação

1. **Coolify → Applications → New → Dockerfile** (não Docker Compose)
2. Configurar:
   - **Git Repository:** URL do repositório SGDE
   - **Build Pack:** `Dockerfile` (nativo)
   - **Port:** `3000`
3. **Não conectar banco de dados pela UI** — o BD é externo (no Portainer). A `DATABASE_URL` será definida manualmente.

> ⚠️ **Não use o `docker-compose.yml` do repositório no Coolify.** Ele referencia `db:5432` (nome da network do compose) que não existe no ambiente do Coolify. Use apenas o `Dockerfile`.

### 2.2 — Variáveis de ambiente

Definir no Coolify (**Applications → SGDE → Environment Variables**):

```env
# Conexão com o BD externo (Portainer) — use o IP real da VM Portainer
DATABASE_URL="postgresql://postgres:SENHA_HEX_GERADA_AQUI@10.0.0.5:5432/sgde?schema=public"

# Ambiente de produção
NODE_ENV=production
PORT=3000
```

> ⚠️ A `DATABASE_URL` acima usa a **senha nova** (trocada na Parte 1.1) e o **IP interno** da VM Portainer na bridge privada.

### 2.3 — Deploy inicial

1. Clique **Deploy**
2. Acompanhe os logs:
   - ✅ Docker build completo
   - ✅ Container iniciou na porta 3000
3. O app vai subir, mas **ainda sem migrations aplicadas e sem usuários**. Prosseguir para 2.4 e 2.5.

### 2.4 — Rodar as migrations (manualmente, até a Parte 3 ser implementada)

> Enquanto a Parte 3 não for implementada, as migrations não rodam automaticamente no startup do container. É preciso rodar manualmente.

No **terminal do container** no Coolify:

```bash
pnpm db:migrate:deploy
```

Confirmar a saída — deve listar as migrations aplicadas sem erros.

### 2.5 — Criar o primeiro gestor (bootstrap)

Ainda no terminal do container no Coolify:

```bash
FIRST_MANAGER_NAME="admin" \
FIRST_MANAGER_PASSWORD="SuaSenhaForteAqui123" \
node scripts/bootstrap-first-manager.mjs
```

**Proteções do script (já implementadas no código):**

| Trava | Comportamento |
|---|---|
| Se já existir algum gestor | Ignora e exibe "Bootstrap ignorado: ja existe gestor cadastrado." |
| Se `FIRST_MANAGER_NAME` estiver vazio | Erro e aborta |
| Se `FIRST_MANAGER_PASSWORD` < 8 chars | Erro e aborta |
| Se o nome já existir com role diferente | Erro e aborta |

> Após criar o gestor, faça login no app com o nome e senha definidos.

### 2.6 — Fluxo de migrations em redeploy (importante)

> Esta seção explica como as migrations se comportam ao fazer `git push` e o Coolify redeployar. **Ler com atenção** — é a fonte mais comum de confusão com Prisma.

#### Antes da Parte 3 ser implementada: migrations são manuais

Hoje o `Dockerfile` termina com `CMD ["node_modules/.bin/next", "start"]` — nada roda migrations no startup. Então:

```
git push → Coolify reconstrói imagem → novo container sobe → next start
                                                              ↑
                                              migrations NÃO rodam aqui
```

A cada deploy com schema novo, é preciso **manualmente** entrar no terminal do container e rodar `pnpm db:migrate:deploy`. Propenso a esquecimento.

#### Depois da Parte 3 implementada: migrations são automáticas

Com o `docker-entrypoint.sh` (Alteração 1) + `ENTRYPOINT` no Dockerfile (Alteração 2):

```
git push → Coolify reconstrói imagem → novo container sobe
                                              ↓
                              entrypoint.sh executa:
                              1. pnpm db:migrate:deploy  ← roda migrations pendentes
                              2. exec next start          ← só inicia o app se migrations OK
```

A partir daí, **todo redeploy aplica migrations automaticamente**.

#### ⚠️ Detalhe crítico: as migrations precisam estar commitadas

O `prisma migrate deploy` **não lê o `schema.prisma`** — ele aplica **arquivos de migration** que estão em `prisma/migrations/`. Então o fluxo correto de desenvolvimento é:

```
1. Alterar prisma/schema.prisma
2. Rodar localmente: pnpm db:migrate dev
   → isso CRIA um novo arquivo em prisma/migrations/NNNN_nome/migration.sql
3. Commitar AMBOS:
   - prisma/schema.prisma (alterado)
   - prisma/migrations/NNNN_.../migration.sql (novo arquivo)
4. git push
5. Coolify redeploy → entrypoint roda migrate deploy → aplica a migration nova
```

> ❌ **Se você só commitar o `schema.prisma` sem o arquivo de migration**, o `migrate deploy` não vai aplicar nada (ele não sabe o que mudou). Confusão comum: `prisma migrate dev` (cria migrations) vs `prisma migrate deploy` (aplica migrations já criadas).

#### Resumo

| Situação | Migrations rodam sozinhas no redeploy? |
|---|---|
| Antes da Parte 3 | ❌ Não — rodar manual `pnpm db:migrate:deploy` |
| Depois da Parte 3 | ✅ Sim — entrypoint roda automaticamente |
| Schema alterado sem criar migration | ❌ Não — `migrate deploy` só aplica arquivos de migration commitados |
| Migration criada + commitada | ✅ Sim — aplica no próximo redeploy |

### 2.7 — Remover o app antigo do Portainer

Após confirmar que o app no Coolify está funcionando (login OK, dados carregando):

1. **Portainer → Containers** → parar e remover o container `sgde-app`
2. O container `sgde-migrate` e `sgde-bootstrap` (se existirem) também podem ser removidos — não são mais usados
3. Manter apenas o `sgde-db`

---

## Parte 3 — Alterações no Projeto (para outro agente de IA)

> **Instruções para o agente implementador:** Esta seção descreve as alterações necessárias no código do projeto SGDE para que o deploy no Coolify seja robusto (migrations automáticas + healthcheck). Cada item especifica o objetivo, o arquivo, a mudança exata esperada e a justificativa. Implemente na ordem apresentada.

### Estado atual vs. estado desejado

| Aspecto | Estado atual | Estado desejado |
|---|---|---|
| Migrations no startup | Serviço separado `migrate` no compose (manual) | Automáticas no entrypoint do container |
| Healthcheck | Inexistente | Endpoint `/api/health` + `HEALTHCHECK` no Dockerfile |
| Entrypoint | `CMD ["node_modules/.bin/next", "start"]` direto | Script `docker-entrypoint.sh` que roda migrations e depois `exec next start` |
| `DATABASE_URL` no compose | Hardcoded `postgresql://postgres:postgres@db:5432/sgde` | Via `${DATABASE_URL:-...}` (permite override) |
| Compose do BD pro Portainer | Inexistente (tudo num compose só) | `docker-compose.db.yml` separado, só com BD |

---

### Alteração 1 — Criar `scripts/docker-entrypoint.sh`

**Objetivo:** Script de bootstrap do container que roda migrations pendentes antes de iniciar o Next.js, com possibilidade de desabilitar via env var.

**Arquivo a criar:** `scripts/docker-entrypoint.sh`

**Comportamento esperado:**

1. Se `RUN_MIGRATIONS` for diferente de `false` (padrão: `true`), executar `pnpm db:migrate:deploy`
2. Se o comando de migrations falhar, **abortar o startup** (exit non-zero) — não iniciar o app com schema inconsistente
3. Após migrations, executar o comando passado (`exec "$@"`) para iniciar o Next.js
4. Usar `exec` para que o processo `next` substitua o shell e receba sinais (SIGTERM, etc.) diretamente

**Especificação do script:**

```bash
#!/bin/sh
set -e

# Migrations automáticas (padrão: habilitado)
if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  echo "[entrypoint] Aplicando migrations pendentes..."
  pnpm db:migrate:deploy
  echo "[entrypoint] Migrations concluídas."
else
  echo "[entrypoint] Migrations automáticas desabilitadas (RUN_MIGRATIONS=false)."
fi

# Repassa o comando (CMD do Dockerfile) para o next start
exec "$@"
```

**Requisitos:**

- Usar `#!/bin/sh` (compatível com alpine, não assume bash)
- `set -e` para abortar em qualquer erro
- `exec "$@"` no final (repassa o CMD do Dockerfile)
- Deve ser executável (`chmod +x`)

**Justificativa:** Permite que cada novo deploy aplique migrations pendentes automaticamente, sem intervenção manual. A env var `RUN_MIGRATIONS=false` permite desabilitar em cenários com múltiplas réplicas (só a primeira roda migrations).

---

### Alteração 2 — Atualizar o `Dockerfile`

**Objetivo:** Usar o entrypoint novo + adicionar `HEALTHCHECK`.

**Arquivo:** `Dockerfile`

**Mudanças necessárias no estágio `runner` (linhas finais):**

1. Copiar `scripts/docker-entrypoint.sh` do estágio `builder`
2. Tornar o script executável
3. Definir `ENTRYPOINT` apontando para o script
4. Manter o `CMD` atual (será repassado ao entrypoint via `exec "$@"`)
5. Adicionar `HEALTHCHECK`

**Estado atual (estágio runner):**

```dockerfile
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]
```

**Estado desejado (estágio runner):**

```dockerfile
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV RUN_MIGRATIONS=true

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Entrypoint com migrations automáticas
RUN chmod +x scripts/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --quiet --spider http://localhost:${PORT:-3000}/api/health || exit 1

ENTRYPOINT ["scripts/docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start"]
```

**Pontos de atenção:**

| Item | Detalhe |
|---|---|
| `ENV RUN_MIGRATIONS=true` | Padrão habilitado. Override via env vars do Coolify se precisar desabilitar. |
| `wget` no HEALTHCHECK | Disponível no `node:20-alpine` (busybox wget). Não precisa instalar curl. |
| `${PORT:-3000}` no HEALTHCHECK | Usa a env var `PORT` (com fallback `3000`). Assim o healthcheck funciona **independente da porta** definida no deploy do Coolify. |
| `EXPOSE 3000` | Apenas metadata/documentação. Não precisa alterar mesmo se usar outra porta — o Coolify usa a **Port** das settings da aplicação, não o `EXPOSE`. |
| `--start-period=30s` | Janela de tolerância pra o 1º deploy (migrations + build do Next.js). |
| `ENTRYPOINT` + `CMD` | O `CMD` vira argumento pro `ENTRYPOINT` (script), que faz `exec "$@"` no final. |

> ⚠️ **Porta configurável:** O deploy não precisa usar a porta padrão 3000. Para usar outra porta, defina `PORT=xxxx` nas env vars do Coolify **e** atualize a **Port** nas settings da aplicação para o mesmo valor. O `HEALTHCHECK` acima já é compatível com qualquer porta graças ao `${PORT:-3000}`.

**Justificativa:** O `HEALTHCHECK` permite que o Coolify detecte containers unhealthy e o entrypoint garante migrations automáticas em todo redeploy. O uso de `${PORT:-3000}` torna o healthcheck independente da porta de deploy.

---

### Alteração 3 — Criar `app/api/health/route.ts`

**Objetivo:** Endpoint de healthcheck que o `HEALTHCHECK` do Dockerfile consome.

**Arquivo a criar:** `app/api/health/route.ts`

**Comportamento esperado:**

- `GET /api/health` retorna `200 OK` com corpo simples (ex: `{ "status": "ok" }`)
- **Não deve verificar o BD** — healthcheck de container precisa ser rápido e não derrubar o container se o BD estiver momentaneamente indisponível. O objetivo é saber se o processo Next.js está respondendo, não se todas as dependências estão saudáveis.
- Sem autenticação (rota pública)

**Especificação:**

```ts
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ status: "ok" })
}
```

**Justificativa:** Endpoint mínimo para o Docker `HEALTHCHECK` verificar se o processo está vivo. Verificação de BD fica fora do healthcheck pra evitar reinícios em cascata se o BD oscilar.

---

### Alteração 4 — Criar `docker-compose.db.yml`

**Objetivo:** Compose isolado só com o BD, para uso no Portainer, com porta exposta na interface interna.

**Arquivo a criar:** `docker-compose.db.yml`

**Especificação:**

```yaml
# Compose isolado do PostgreSQL para o Portainer.
# O app roda no Coolify (ver Docs/plano-deploy-coolify.md).
#
# Uso:
#   docker compose -f docker-compose.db.yml up -d
#
# ⚠️ Substitua POSTGRES_PASSWORD e o IP do bind pelos valores reais.
services:
  db:
    image: postgres:16-alpine
    container_name: sgde-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: sgde
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?definir-no-.env}
    ports:
      - "${DB_BIND_IP:-10.0.0.5}:5432:5432"   # bind na interface interna
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d sgde"]
      interval: 5s
      timeout: 3s
      retries: 20
    volumes:
      - sgde_pgdata:/var/lib/postgresql/data

volumes:
  sgde_pgdata:
```

**Requisitos:**

- Usar `${POSTGRES_PASSWORD:?...}` para obrigar a definição da senha (falha se não definida, evita rodar com senha vazia)
- Usar `${DB_BIND_IP:-10.0.0.5}` para o bind (IP interno da VM Portainer na bridge privada)
- Não expor em `0.0.0.0` (default do Docker) — sempre bind em IP específico

**Justificativa:** Separa a infraestrutura do BD (Portainer) da aplicação (Coolify). O compose original (`docker-compose.yml`) continua servindo para dev local completo.

---

### Alteração 5 — Atualizar `docker-compose.yml` (dev local)

**Objetivo:** Permitir override da `DATABASE_URL` via env var, mantendo o default pra dev local.

**Arquivo:** `docker-compose.yml`

**Mudança:** Substituir as 3 ocorrências de `DATABASE_URL: postgresql://postgres:postgres@db:5432/sgde?schema=public` por `DATABASE_URL: ${DATABASE_URL:-postgresql://postgres:postgres@db:5432/sgde?schema=public}`.

**Estado atual (3 ocorrências):**

```yaml
# serviço migrate
environment:
  DATABASE_URL: postgresql://postgres:postgres@db:5432/sgde?schema=public

# serviço bootstrap
environment:
  DATABASE_URL: postgresql://postgres:postgres@db:5432/sgde?schema=public

# serviço app
environment:
  DATABASE_URL: postgresql://postgres:postgres@db:5432/sgde?schema=public
```

**Estado desejado:**

```yaml
# Em todos os 3 serviços:
environment:
  DATABASE_URL: ${DATABASE_URL:-postgresql://postgres:postgres@db:5432/sgde?schema=public}
```

**Justificativa:** Mantém o compose funcional para dev local (default `postgres:postgres@db`) mas permite override via `.env` ou env vars externas — útil se a senha do dev local mudar ou para apontar pra um BD externo.

---

### Alteração 6 — Atualizar `.env.example`

**Objetivo:** Documentar as novas variáveis de ambiente.

**Arquivo:** `.env.example`

**Estado atual:**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sgde?schema=public"
APP_PORT="3000"

# Opcional para bootstrap em producao (docker compose --profile ops run bootstrap)
FIRST_MANAGER_NAME=""
FIRST_MANAGER_PASSWORD=""
```

**Estado desejado:**

```env
# Conexão com o banco (dev local)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sgde?schema=public"

# Porta do app exposta no host (dev local)
APP_PORT="3000"

# Migrations automáticas no startup do container (Dockerfile)
# true  = roda `prisma migrate deploy` antes de iniciar (padrão)
# false = não roda migrations (use se houver múltiplas réplicas)
RUN_MIGRATIONS=true

# Opcional para bootstrap em producao (docker compose --profile ops run bootstrap)
FIRST_MANAGER_NAME=""
FIRST_MANAGER_PASSWORD=""
```

**Justificativa:** Documenta `RUN_MIGRATIONS` que passa a ser usada pelo entrypoint do container.

---

### Resumo das alterações da Parte 3

| # | Arquivo | Ação |
|---|---|---|
| 1 | `scripts/docker-entrypoint.sh` | Criar |
| 2 | `Dockerfile` | Editar (entrypoint + healthcheck) |
| 3 | `app/api/health/route.ts` | Criar |
| 4 | `docker-compose.db.yml` | Criar |
| 5 | `docker-compose.yml` | Editar (DATABASE_URL via env) |
| 6 | `.env.example` | Editar (adicionar RUN_MIGRATIONS) |

---

## Ordem de Execução Consolidada

### Cenário: zero downtime desnecessário

```
┌─ Portainer (Parte 1) ─────────────────────────────────────────┐
│ 1. Trocar senha do postgres (ALTER USER)                      │
│ 2. Editar compose: expor porta + remover serviços app/migrate │
│ 3. docker compose up -d (recria só o container do BD)         │
│ 4. Testar conectividade a partir da VM Coolify                │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ Coolify (Parte 2) ───────────────────────────────────────────┐
│ 5. Criar aplicação via Dockerfile                             │
│ 6. Definir DATABASE_URL com senha nova + IP interno           │
│ 7. Deploy inicial                                             │
│ 8. Rodar migrations manualmente (pnpm db:migrate:deploy)      │
│ 9. Criar 1º gestor (bootstrap-first-manager.mjs)              │
│ 10. Validar: login OK, dados carregando                        │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ Portainer (Parte 1, continuação) ──────────────────────────┐
│ 11. Remover container sgde-app (não é mais usado)             │
│ 12. Atualizar POSTGRES_PASSWORD no compose (consistência)     │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ Projeto (Parte 3 — outro agente de IA) ────────────────────┐
│ 13. Implementar alterações 1-6 (entrypoint, healthcheck, etc) │
│ 14. Commit + push                                             │
│ 15. Coolify redeploy automático (se auto-deploy on)           │
│ 16. A partir daqui, migrations rodam sozinhas no startup      │
└───────────────────────────────────────────────────────────────┘
```

> 💡 **A Parte 3 pode ser feita antes ou depois do deploy inicial.** Se feita antes, o passo 8 (migrations manuais) é automático. Se feita depois, o 1º deploy precisa do passo 8 manual, mas os próximos já serão automáticos.

---

## Troubleshooting

### App não conecta no BD — `Can't reach database server`

**Causa:** `DATABASE_URL` errada ou BD não acessível a partir da VM Coolify.

**Solução:**

1. Confirmar o IP da VM Portainer na bridge privada (`ip a` na VM Portainer)
2. Confirmar se o container `sgde-db` está com a porta mapeada (`docker ps` na VM Portainer)
3. Testar conectividade a partir da VM Coolify: `psql -h 10.0.0.5 -U postgres -d sgde`
4. Verificar se a senha na `DATABASE_URL` é a **nova** (trocada na Parte 1.1)
5. Verificar se a bridge privada do Proxmox conecta as 2 VMs

### Migrations falham no startup — `relation already exists`

**Causa:** Migrations foram aplicadas manualmente (Parte 2.4) e o entrypoint tenta reaplicar.

**Solução:** Isso não deve acontecer — `prisma migrate deploy` só aplica migrations pendentes (rastreia via tabela `_prisma_migrations`). Se ocorrer, verifique se a tabela `_prisma_migrations` existe e está íntegra.

### Healthcheck falhando — Coolify marca como unhealthy

**Causa:** Endpoint `/api/health` não responde ou demora mais que `--timeout=5s`.

**Solução:**

1. Testar manualmente no container: `wget -qO- http://localhost:${PORT:-3000}/api/health`
2. Se retornar 200, aumentar `--start-period` no Dockerfile (app demora a subir)
3. Se retornar 404, confirmar que a Alteração 3 (Parte 3) foi implementada

### Login funciona mas redirect volta pra login

**Causa:** Cookie com `secure=true` em HTTP. O Coolify serve HTTPS via proxy reverso, mas a conexão interna proxy→container é HTTP.

**Solução:** Comportamento correto — o `secure` verifica a conexão original (proxy→browser), não a interna. Confirmar que o Coolify está servindo o domínio com HTTPS (Let's Encrypt).

### Container do BD não inicia após trocar senha

**Causa:** Provável erro de sintaxe no `ALTER USER` ou senha com caracteres especiais.

**Solução:**

1. Se usou `openssl rand -hex 24`, a senha só tem `[0-9a-f]` — sem caracteres especiais
2. Se usou outra senha com caracteres especiais, verificar se o `DATABASE_URL` está corretamente encoded (ex: `@` → `%40`)
3. Conectar no postgres sem senha (modo recovery) e redefinir: `docker exec -it sgde-db psql -U postgres`

---

## Referências

- [deploy-coolify.md](./deploy-coolify.md) — guia de deploy do projeto SGDCF (referência)
- [tecnico.md](./tecnico.md) — documentação técnica do SGDE
- [Dockerfile](../Dockerfile) — build do container
- [docker-compose.yml](../docker-compose.yml) — orquestração dev local
- [scripts/bootstrap-first-manager.mjs](../scripts/bootstrap-first-manager.mjs) — criação do 1º gestor
