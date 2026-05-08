# Sistema de Gestao de Demandas Eletricas (SGDE)

Documentacao tecnica e funcional do SGDE para onboarding de novos devs e manutencao do produto.

## 1) Visao Geral

O SGDE centraliza o agendamento, monitoramento e execucao de servicos eletricos com dois perfis:

- `gestor`: cria chamados, distribui responsaveis e monitora a operacao global.
- `eletricista`: acompanha suas demandas, atualiza status e pode remanejar agenda com justificativa.

Objetivo do sistema: reduzir conflitos de horario, aumentar rastreabilidade das alteracoes e dar autonomia operacional ao time de campo.

## 2) Escopo Funcional Atual

### 2.1 Gestao de equipes e cadastro

- Cadastro/logon por perfil (gestor e eletricista).
- Identificacao de demanda por tecnico/equipe.
- Filtro de visualizacao por eletricista no calendario.

### 2.2 Painel do gestor

- Criacao de demanda via modal com dados essenciais (tecnico, equipe, local, descricao, horario, duracao, status inicial e observacoes).
- Visao global com calendario mensal + lista detalhada.
- Atualizacao de status das demandas.

### 2.3 Interface do eletricista

- Agenda filtrada automaticamente para o proprio tecnico.
- Atualizacao de status da demanda.
- Remanejamento de horario e duracao.
- Campo obrigatorio de observacao quando houver mudanca de data/horario.
- Inclusao de colaboradores adicionais (participantes) durante a execucao.

## 3) Regras de Negocio Implementadas

- Login com papel de acesso (`gestor` ou `eletricista`).
- Eletricista visualiza apenas suas demandas por padrao.
- Gestor visualiza todos e pode filtrar por tecnico.
- Alteracao de agenda exige justificativa textual se o horario for alterado.
- Participantes adicionais nao incluem o tecnico principal e nao podem duplicar nomes.
- Demandas sao ordenadas cronologicamente por `horarioInicio`.

## 4) Estrutura de Dados

Tipo principal (`Demand`) atualmente definido em `lib/demands.ts`:

```ts
type Demand = {
  id: string
  tecnico: string
  equipe: string
  local: string
  descricao: string
  status: "Pendente" | "Em Andamento" | "Concluido"
  horarioInicio: string // ISO datetime
  duracaoPrevista: string // ex: 02:00h
  observacoes: string
  participantes: string[]
}
```

Mapeamento com campos funcionais esperados:

- `ID / Protocolo` -> `id`
- `Responsavel` -> `tecnico` (e `equipe`)
- `Solicitante` -> **ainda nao modelado explicitamente**
- `Colaboradores` -> `participantes`
- `Localizacao` -> `local`
- `Descricao` -> `descricao`
- `Tempo Previsto` -> `duracaoPrevista`
- `Status` -> `status`
- `Historico de Alteracoes` -> **ainda nao implementado como log estruturado**

## 5) Arquitetura Tecnica

### 5.1 Stack

- `Next.js 16` (App Router)
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `shadcn/ui` (componentes base)
- `lucide-react` (icones)

### 5.2 Estrutura principal

- `app/page.tsx`: entrypoint da interface.
- `components/templates/demands-dashboard.tsx`: orquestracao de estado, regras e composicao da tela.
- `components/organisms/*`: blocos de UI de alto nivel (calendario, modais, login, painel do dia etc.).
- `components/molecules/*`: componentes de detalhe (cards/pills de demanda).
- `lib/demands.ts`: tipo `Demand`, status e dados mock.
- `lib/calendar.ts`: utilitarios de calendario e formatacao de datas.
- `lib/auth.ts`: tipos de sessao e papeis.

### 5.3 Fluxo da aplicacao

1. Usuario seleciona perfil no login (`LoginScreen`).
2. `DemandsDashboard` inicializa sessao e dataset de demandas (mock em memoria).
3. Interface muda dinamicamente pelo perfil:
   - gestor: visao global e criacao de chamados.
   - eletricista: visao focada no proprio nome.
4. Atualizacoes de status/agenda ocorrem em estado local React.
5. Modais controlam criacao e edicao de demandas.

## 6) Componentes-Chave

- `DemandsDashboard`: estado central (`session`, `demands`, filtros, calendario, modais).
- `CreateDemandModal`: formulario de abertura de chamado.
- `ScheduleEditModal`: remanejamento de horario com justificativa e participantes.
- `DemandCalendar`: grade mensal (42 dias) com eventos por dia.
- `DaySchedulePanel`: foco no dia selecionado.
- `DemandDetailsList` + `DemandCard`: operacoes rapidas em lista.

## 7) Estado e Persistencia (Status Atual)

Estado atual do projeto:

- Fonte de dados: `mockDemands` em `lib/demands.ts`.
- Persistencia: nao ha banco/API conectados.
- Autenticacao: simulada no front.

Pontos ja marcados no codigo com `TODO`:

- Integracao de carregamento inicial via API GET.
- Integracao de criacao/edicao de demandas via API POST/PATCH.
- Integracao da autenticacao por perfil.

## 8) Permissoes por Perfil (Comportamento Atual)

- `gestor`
  - Cria chamados.
  - Visualiza todos os tecnicos.
  - Filtra por tecnico.
  - Altera status.
  - Edita agenda.

- `eletricista`
  - Entra com nome proprio.
  - Filtro de tecnico travado no proprio nome.
  - Altera status das proprias demandas.
  - Remaneja horario com justificativa.
  - Adiciona colaboradores.

## 9) Calendario e Datas

- Chave de agrupamento diario: `YYYY-MM-DD` (`getDateKey`).
- Grade mensal fixa de 42 celulas (`buildCalendarDays`) para manter layout consistente.
- Data/hora de entrada em formulario (`datetime-local`) convertida para ISO.
- Formatadores localizados em `pt-BR` para mes, data e hora.

## 10) Lacunas Tecnicas Importantes (Para Manutencao)

Para aderir ao desenho funcional completo, priorizar:

1. Adicionar `solicitante` no modelo de demanda.
2. Implementar historico de alteracoes como estrutura dedicada (quem, quando, o que mudou, motivo).
3. Criar camada de servicos/API para substituir dados mock.
4. Implementar RBAC no backend (nao apenas no front).
5. Garantir auditoria de remanejamentos e mudancas de status.

Sugestao de extensao de modelo:

```ts
type DemandHistoryEntry = {
  changedBy: string
  changedAt: string // ISO datetime
  action: "status_update" | "schedule_change" | "participants_update"
  previousValue?: unknown
  nextValue?: unknown
  reason?: string
}
```

## 11) Boas Praticas de Evolucao

- Manter tipos de dominio em `lib/*` (evitar tipos duplicados em componentes).
- Centralizar regras de negocio criticas (ex.: validacao de justificativa) em funcoes testaveis.
- Encapsular acesso a API em um modulo proprio (`services/` ou `lib/api/`).
- Incluir testes para regras de permissao por perfil e historico de alteracoes.
- Validar payloads de entrada (zod ou equivalente) antes de persistir.

## 12) Guia Rapido para Novos Devs

### Rodar localmente

```bash
pnpm install
pnpm dev
```

App em desenvolvimento: `http://localhost:3000`.

### Scripts uteis

- `pnpm dev`: ambiente local com hot reload.
- `pnpm build`: build de producao.
- `pnpm start`: sobe build de producao.
- `pnpm lint`: linting.
- `pnpm typecheck`: checagem de tipos TypeScript.
- `pnpm format`: formatacao do codigo.

### Onde mexer para cada demanda tecnica

- Nova regra de negocio de demanda: `lib/demands.ts` + `components/templates/demands-dashboard.tsx`.
- Ajustes de calendario: `lib/calendar.ts` + `components/organisms/demand-calendar.tsx`.
- Fluxo de autenticacao/perfis: `lib/auth.ts` + `components/organisms/login-screen.tsx`.
- Criacao/edicao de chamado: `create-demand-modal.tsx` e `schedule-edit-modal.tsx`.

## 13) Roadmap Sugerido

- Fase 1: API e persistencia real (demands, users, auth).
- Fase 2: historico/auditoria completo e trilha de remanejamentos.
- Fase 3: regras avancadas de conflito de agenda e disponibilidade em tempo real.
- Fase 4: notificacoes (mudanca de horario, atribuicoes, conclusao).
- Fase 5: indicadores operacionais (SLA, backlog por equipe, taxa de remanejamento).

---

Se este documento ficar desatualizado, atualize primeiro:

1. `Estrutura de Dados`
2. `Permissoes por Perfil`
3. `Lacunas Tecnicas`

Essas tres secoes concentram as decisoes de manutencao mais sensiveis do SGDE.
