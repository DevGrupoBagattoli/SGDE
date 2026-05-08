# SGDE — Documentação Técnica

> Esta documentação descreve o estado atual do projeto (MVP/protótipo front-end). Como o sistema ainda está em desenvolvimento ativo, detalhes de implementação podem mudar.

---

## Stack Tecnológica

| Categoria | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript |
| UI | React 19 |
| Estilização | Tailwind CSS v4 |
| Componentes base | shadcn/ui + Radix UI |
| Ícones | Lucide React |
| Temas | next-themes |
| Package Manager | pnpm |

---

## Estrutura de Pastas

```
/
├── app/                     # Rotas Next.js (App Router)
│   ├── layout.tsx           # Layout raiz — fontes, ThemeProvider
│   ├── page.tsx             # Rota "/" — renderiza DemandsDashboard
│   └── globals.css          # Estilos globais e variáveis CSS
│
├── components/
│   ├── atoms/               # Componentes mínimos, sem lógica
│   │   ├── metric-card.tsx  # Cartão de métrica numérica
│   │   └── status-badge.tsx # Badge colorido de status
│   │
│   ├── molecules/           # Combinações de átomos com alguma lógica de apresentação
│   │   ├── calendar-event-pill.tsx  # Pílula de evento no calendário
│   │   ├── demand-card.tsx          # Card completo de uma demanda
│   │   ├── demand-time-slot.tsx     # Item de horário no painel do dia
│   │   └── login-role-card.tsx      # Cartão de perfil na tela de login
│   │
│   ├── organisms/           # Seções completas de interface
│   │   ├── create-demand-modal.tsx  # Modal de criação de demanda
│   │   ├── dashboard-hero.tsx       # Cabeçalho sticky do dashboard
│   │   ├── day-schedule-panel.tsx   # Painel de horários do dia selecionado
│   │   ├── demand-calendar.tsx      # Calendário mensal central
│   │   ├── demand-details-list.tsx  # Lista de cards de demandas
│   │   ├── demand-summary.tsx       # Linha de cartões de métricas
│   │   ├── login-screen.tsx         # Tela de login completa
│   │   └── schedule-edit-modal.tsx  # Modal de edição de horário
│   │
│   ├── templates/
│   │   └── demands-dashboard.tsx    # Orquestrador principal — todo o estado da aplicação
│   │
│   ├── theme-provider.tsx   # Wrapper de tema (next-themes)
│   └── ui/
│       └── button.tsx       # Botão base (shadcn/ui)
│
├── lib/
│   ├── auth.ts              # Tipos e constantes de autenticação/sessão
│   ├── calendar.ts          # Utilitários e formatadores de data
│   ├── demands.ts           # Tipos, dados mock e estilos de status
│   └── utils.ts             # Utilitário `cn` (clsx + tailwind-merge)
│
└── hooks/                   # (pasta reservada para hooks customizados futuros)
```

---

## Modelos de Dados

### `UserSession` (`lib/auth.ts`)

Representa a sessão ativa do usuário logado.

```ts
type UserRole = "gestor" | "eletricista"

type UserSession = {
  name: string
  role: UserRole
}
```

### `Demand` (`lib/demands.ts`)

Representa um chamado/demanda elétrica.

```ts
type DemandStatus = "Pendente" | "Em Andamento" | "Concluído"

type Demand = {
  id: string
  tecnico: string
  equipe: string
  local: string
  descricao: string
  status: DemandStatus
  horarioInicio: string   // ISO 8601
  duracaoPrevista: string // ex: "02:00h"
  observacoes: string
}
```

---

## Arquitetura de Estado

Todo o estado da aplicação está centralizado no componente `DemandsDashboard` (`components/templates/demands-dashboard.tsx`). Não há gerenciador de estado externo (Zustand, Redux etc.) neste estágio.

### Estados principais

| Estado | Tipo | Descrição |
|---|---|---|
| `session` | `UserSession \| null` | Sessão do usuário logado. `null` = tela de login. |
| `demands` | `Demand[]` | Lista de todas as demandas (mock por enquanto). |
| `selectedTechnician` | `string` | Filtro ativo de técnico. `"Todos"` = sem filtro. |
| `currentMonth` | `Date` | Mês exibido no calendário. |
| `selectedDate` | `Date` | Dia selecionado para exibição no painel de horários. |
| `editingDemand` | `Demand \| null` | Demanda em edição de horário. Controla abertura do modal. |
| `isCreateModalOpen` | `boolean` | Controla abertura do modal de criação. |

### Dados derivados (useMemo)

- `technicians` — lista deduplicada de técnicos + opção "Todos".
- `filteredDemands` — demandas filtradas por técnico, ordenadas por horário de início.
- `statusTotals` — contagem de demandas por status.
- `calendarDays` — grade de 42 dias para o mês atual.
- `demandsByDate` — demandas agrupadas por chave de data (`"YYYY-MM-DD"`).

---

## Fluxo de Autenticação (atual)

A autenticação é **simulada no front-end**. Não há chamada de API real.

1. Enquanto `session === null`, o componente renderiza `<LoginScreen>`.
2. Ao submeter o formulário de login, `handleLogin` recebe um `UserSession` e define o estado.
3. Se o perfil for `"eletricista"`, `selectedTechnician` é automaticamente fixado no nome do técnico.
4. Ao clicar em "Sair", `handleLogout` limpa o estado de sessão, voltando à tela de login.

**TODO nos componentes de login:**
```ts
// TODO: Integrar com API POST de autenticação do gestor.
// TODO: Integrar com API POST de autenticação do eletricista.
```

---

## Pontos de Integração com Backend (TODOs)

Os comentários `TODO` no código marcam onde a integração com a API deve ocorrer:

| Arquivo | Ação esperada |
|---|---|
| `demands-dashboard.tsx` (useEffect) | `GET /demandas` — carregar lista inicial. |
| `demands-dashboard.tsx` (handleUpdateStatus) | `PATCH /demandas/:id` — atualizar status. |
| `demands-dashboard.tsx` (handleCreateDemand) | `POST /demandas` — criar novo chamado. |
| `demands-dashboard.tsx` (handleUpdateSchedule) | `PATCH /demandas/:id` — atualizar horário e observações. |
| `login-screen.tsx` (handleManagerLogin) | `POST /auth/login` — autenticar gestor. |
| `login-screen.tsx` (handleTechnicianLogin) | `POST /auth/login` — autenticar eletricista. |

---

## Roteamento

O projeto usa o **App Router** do Next.js. Atualmente há apenas uma rota:

| Rota | Componente | Descrição |
|---|---|---|
| `/` | `DemandsDashboard` | Toda a aplicação está nesta rota. O "roteamento" entre login e dashboard é feito por estado interno, não por URL. |

Quando o backend for integrado, considerar separar `/login` como rota própria e proteger `/` com middleware de autenticação.

---

## Convenções do Projeto

- **Hierarquia de componentes:** `atoms → molecules → organisms → templates`. Componentes de nível superior não devem ser importados por componentes de nível inferior.
- **Nenhum componente de organismo gerencia estado global** — state lifting está concentrado no template.
- **Formatação de datas:** toda a lógica de formatação está em `lib/calendar.ts` usando `Intl.DateTimeFormat` com locale `pt-BR`.
- **Estilos condicionais:** uso do utilitário `cn()` (clsx + tailwind-merge) para composição de classes Tailwind.
- **Dados mock:** `lib/demands.ts` exporta `mockDemands` com 4 demandas de exemplo para desenvolvimento.
