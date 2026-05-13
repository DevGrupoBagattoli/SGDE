# SGDE - Sistema de Gestao de Demandas Eletricas

Aplicacao web para gestao de demandas eletricas com:

- frontend em Next.js 16 (App Router)
- backend no proprio Next.js (Route Handlers em app/api)
- banco PostgreSQL com Prisma ORM
- autenticacao por perfil (gestor e eletricista)
- autorizacao no servidor
- trilha de auditoria de alteracoes

## Visao geral

O SGDE permite:

- login de gestor e eletricista
- listagem de demandas por perfil
- criacao de demanda (somente gestor)
- atualizacao de status e agenda com controle de concorrencia
- suporte a demandas multi-dia
- historico de alteracoes por demanda

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Prisma 6
- PostgreSQL
- Zod

## Requisitos

- Node.js 20+
- pnpm 10+
- PostgreSQL 14+

## Setup rapido

1. Instale dependencias:

```bash
pnpm install
```

2. Configure variaveis de ambiente:

```bash
cp .env.example .env
```

Edite o valor de DATABASE_URL no arquivo .env para apontar para seu PostgreSQL.

Exemplo:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sgde?schema=public"
```

3. Gere o client do Prisma:

```bash
pnpm db:generate
```

4. Rode migrations:

```bash
pnpm db:migrate
```

5. Popule dados iniciais:

```bash
pnpm db:seed
```

6. Inicie o projeto:

```bash
pnpm dev
```

Aplicacao: http://localhost:3000

## Credenciais de seed

Gestor:

- nome: Gestor Operacional
- senha: admin123

Eletricistas:

- Joao Silva / 1234
- Mariana Costa / 1234
- Carlos Lima / 1234
- Equipe Beta / 1234

## Scripts uteis

- pnpm dev: inicia ambiente de desenvolvimento
- pnpm build: gera build de producao
- pnpm start: sobe app em modo producao
- pnpm typecheck: validacao TypeScript
- pnpm lint: validacao ESLint
- pnpm format: formatacao dos arquivos TS/TSX
- pnpm db:generate: gera Prisma Client
- pnpm db:migrate: cria/aplica migration local
- pnpm db:migrate:deploy: aplica migrations em producao
- pnpm db:seed: popula base com dados iniciais
- pnpm bootstrap:first-manager: cria o primeiro gestor de forma idempotente

## Deploy com Docker (producao)

Este repositorio inclui [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml) e script de bootstrap inicial.

Importante:

- este fluxo nao inclui Nginx/Traefik
- o seed atual e para dev/homolog e nao deve ser usado em producao
- o bootstrap cria o primeiro gestor somente se ainda nao existir nenhum gestor

### 1) Configure variaveis de ambiente

No host, defina ao menos:

```bash
export FIRST_MANAGER_NAME="Gestor Inicial"
export FIRST_MANAGER_PASSWORD="troque-por-uma-senha-forte"
```

Se preferir, voce pode colocar esses valores em um arquivo .env usado pelo docker compose.

### 2) Build das imagens

```bash
docker compose build
```

### 3) Suba o banco

```bash
docker compose up -d db
```

### 4) Rode migrations de producao

```bash
docker compose --profile ops run --rm migrate
```

### 5) Rode bootstrap do primeiro gestor

```bash
docker compose --profile ops run --rm bootstrap
```

### 6) Suba a aplicacao

```bash
docker compose up -d app
```

Aplicacao: http://localhost:3000

### Comportamento do primeiro usuario

- se nao existir gestor, o script cria o usuario MANAGER com as variaveis FIRST_MANAGER_NAME e FIRST_MANAGER_PASSWORD
- se ja existir qualquer gestor, o script nao altera nada e finaliza com sucesso
- se o nome informado ja existir com outro perfil, o script falha para evitar sobrescrita

## Endpoints principais

Autenticacao:

- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/refresh
- POST /api/auth/logout

Demandas:

- GET /api/demands
- POST /api/demands
- PATCH /api/demands/:id/status
- PATCH /api/demands/:id/schedule
- GET /api/demands/:id/history

Outros:

- GET /api/technicians
- GET /api/openapi

## Permissoes de acesso

Gestor:

- pode ver todas as demandas
- pode criar demanda
- pode editar status e agenda de qualquer demanda

Eletricista:

- ve demandas em que e responsavel
- participantes adicionais possuem acesso de visualizacao
- pode editar apenas demandas em que e responsavel

## Regras de negocio implementadas

- duracao no formato HH:MMh
- demanda com intervalo explicito: inicioPrevisto e fimPrevisto
- suporte a multi-dia (a mesma demanda aparece em todos os dias cobertos)
- remanejamento exige observacao
- conflito de agenda retorna warning nao bloqueante
- concorrencia otimista por version
- auditoria para criacao, status e agenda

## Estrutura resumida

- app/api: rotas backend
- components: UI (atoms, molecules, organisms, templates)
- lib: utilitarios compartilhados e cliente HTTP
- lib/server: infraestrutura backend (auth, csrf, prisma, regras de dominio)
- prisma: schema e seed
- Docs: documentacao funcional e tecnica

## Fluxo recomendado de desenvolvimento

1. Suba o PostgreSQL local.
2. Rode pnpm db:migrate e pnpm db:seed.
3. Rode pnpm dev.
4. Antes de commitar: pnpm typecheck e pnpm lint.

## Troubleshooting

Erro de conexao com banco:

- valide DATABASE_URL no .env
- confirme que o PostgreSQL esta em execucao
- confirme usuario/senha/database

Tabelas nao existem:

- rode pnpm db:migrate
- se necessario, rode pnpm db:seed

Erro de autenticacao apos alteracoes locais:

- faca logout e login novamente
- limpe cookies da aplicacao no navegador

## Observacoes

- Os tokens de sessao usam cookies httpOnly.
- Rotas mutaveis validam CSRF com cookie + header.
- O projeto usa Prisma 6.x neste repositorio.
