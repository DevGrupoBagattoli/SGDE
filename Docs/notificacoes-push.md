# Notificações Push (PWA) — Especificação e Plano de Implementação

> **Issue de origem**: [DevGrupoBagattoli/SGDE#10](https://github.com/DevGrupoBagattoli/SGDE/issues/10) — *feat: sistema de notificações para eletricistas (Web Push PWA + e-mail)*
>
> **Escopo deste documento**: Fase 1 (MVP) + Fase 1.5 (eventos de demanda e loop do gestor — [issue #12](https://github.com/DevGrupoBagattoli/SGDE/issues/12)), com modelo de dados, contratos de API, arquitetura do módulo `lib/notifications`, configuração de deploy e **guia prático de testes**. A Fase 2 (roadmap) está descrita em §12.

## Índice

- [1. Visão geral e decisões](#1-visão-geral-e-decisões)
- [2. Arquitetura e fluxo](#2-arquitetura-e-fluxo)
- [3. Modelo de dados (Prisma)](#3-modelo-de-dados-prisma)
- [4. Módulo `lib/notifications`](#4-módulo-libnotifications)
- [5. Contratos de API](#5-contratos-de-api)
- [6. Agendador e eventos](#6-agendador-e-eventos)
- [7. PWA: manifest, service worker e ícones](#7-pwa-manifest-service-worker-e-ícones)
- [8. UI: sino, painel de notificações e ativação](#8-ui-sino-painel-de-notificações-e-ativação)
- [9. Variáveis de ambiente](#9-variáveis-de-ambiente)
- [10. Deploy: Coolify Scheduled Task](#10-deploy-coolify-scheduled-task)
- [11. Guia prático de testes](#11-guia-prático-de-testes)
- [12. Fase 2 — roadmap](#12-fase-2--roadmap)
- [13. Considerações de segurança](#13-considerações-de-segurança)
- [14. Referências](#14-referências)

---

## 1. Visão geral e decisões

### 1.1 Problema

Notificações que exigem a aba aberta (in-app) ou apenas e-mail são fáceis de ignorar. Os eletricistas precisam ser avisados de eventos do serviço **com o site fechado e o celular bloqueado**.

### 1.2 Decisões (consolidadas da issue #10)

| Decisão | Detalhe |
|---|---|
| **Canal principal** | Web Push (PWA) — chega com site fechado, grátis, sem terceiros; o app já roda em HTTPS (Coolify + Cloudflare Tunnel), requisito do service worker |
| **Canal secundário** | E-mail via **Brevo** — fallback quando o usuário não tem subscription push ativa; eventos CRITICAL usam push **e** e-mail simultâneos (ver §1.3) |
| **Arquitetura** | **Sem microserviço.** Módulo isolado em `lib/notifications/` com interface de canais (`NotificationChannel`), fácil de extrair no futuro se um 2º projeto precisar. Extrair somente quando houver demanda real (reavaliar Novu/OneSignal na ocasião) |
| **Perfil dos destinatários** | Hoje 2 eletricistas, todos Android — sem limitação do iOS (que exigiria PWA instalado na tela inicial) |
| **Agendador** | Endpoint protegido por token, varredura a cada minuto via **Scheduled Task do Coolify** |
| **Estados da notificação** | `ENVIADA` → `LIDA` → `CONFIRMADA` (botão "Ciente"). Implementados pelos campos `sentAt` (em delivery), `readAt` e `ackAt` |

### 1.3 Eventos

**Para o eletricista** (destinatários: técnico responsável + participantes, **exceto o autor da ação**):

| Tipo | Gatilho | Prioridade |
|---|---|---|
| `DEMAND_CREATED` | `POST /api/demands` | CRITICAL |
| `DEMAND_SCHEDULE_CHANGED` | `PATCH /api/demands/[id]/schedule` | CRITICAL |
| `DEMAND_STATUS_CHANGED` | `PATCH /api/demands/[id]/status` | CRITICAL |
| `DEMAND_CANCELLED` | `PATCH /api/demands/[id]/status` (→ `CANCELLED`) | CRITICAL |
| `DEMAND_DESCRIPTION_CHANGED` | `PATCH /api/demands/[id]` | CRITICAL |
| `DEMAND_DELETED` | `DELETE /api/demands/[id]` | CRITICAL |
| `SERVICE_UPCOMING` (existente) | agendador, janela de ~15 min | CRITICAL (era NORMAL) |
| `SERVICE_FINISH_REMINDER` (existente, agora **recorrente**) | agendador, a cada 1h enquanto vencida e ativa | CRITICAL (era NORMAL) |

**Para o gestor** (destinatário: **criador da demanda**):

| Tipo | Gatilho | Prioridade |
|---|---|---|
| `DEMAND_ACK_CONFIRMED` | eletricista clica **"Ciente"** em notificação com demanda vinculada | NORMAL |
| `DEMAND_UNSEEN_ESCALATION` | notificação de evento de demanda **não lida** há ≥ 2h e demanda ainda ativa | CRITICAL |

> **Prioridade centralizada**: a decisão "tudo CRITICAL exceto o ack" vive em `resolvePriority(type)` (`lib/notifications/events.ts`) — introduzir urgência por demanda no futuro muda **apenas** essa função.
>
> **Mecanismo CRITICAL**: push **e** e-mail simultâneos (cada um se disponível) + `requireInteraction: true` no payload do push (a notificação fica fixa na bandeja até ser tratada — o `public/sw.js` já lê o flag). NORMAL mantém o fallback: push, senão e-mail.
>
> Novos tipos de evento podem surgir (lista final a validar com o stakeholder). Por isso o design é orientado a tipos + `dedupeKey`, não a if/elses espalhados.

### 1.4 Critérios de aceite (Fase 1 — da issue)

1. O eletricista ativa as notificações uma vez e recebe o push **com o site fechado e o celular bloqueado**.
2. O lembrete chega **~15 min antes** do início do serviço, **sem duplicidade**.
3. O lembrete de finalização **não é enviado** se a demanda já foi concluída.
4. Há **registro de envio, leitura e confirmação** por notificação (tabelas + endpoint de listagem).

---

## 2. Arquitetura e fluxo

```
                         ┌──────────────────────────┐
                         │  Coolify Scheduled Task   │
                         │  (a cada 1 minuto)       │
                         └────────────┬─────────────┘
                                      │ curl POST + x-cron-token
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/cron/dispatch-notifications                            │
│  └─ lib/notifications/scheduler.ts                                │
│       • consulta demandas candidatas (Prisma)                     │
│       • isUpcomingCandidate / isOverdueCandidate (funções puras)  │
│       • re-verifica status antes de disparar (anti-corrida)       │
│       • resolveRecipients (técnico + participantes)               │
│       └─ dispatcher.notify() por (evento × usuário)               │
│            • dedupeKey única → idempotência                       │
│            • cria Notification + NotificationDelivery             │
│           • decideChannels: CRITICAL → push+email; NORMAL → push│
│            └─ channels/push.ts  → web-push (VAPID) → FCM/APNs     │
│               channels/email.ts → Brevo API                        │
└─────────────────────────────────────────────────────────────────┘
                                      │
                       push chega ao celular mesmo
                       com o site fechado (service worker
                       `public/sw.js` exibe a notificação)
```

**Front-end (uma vez, por dispositivo):**

```
login → sino no header ("Ativar notificações")
      → Notification.requestPermission()
      → pushManager.subscribe(applicationServerKey = VAPID pública)
      → POST /api/push/subscribe (salva PushSubscription)
```

**Fluxo de consulta (site aberto):**

```
sino no header → GET /api/notifications (lista + contador)
              → GET /api/notifications/unread-count (poll 60s / focus / mensagem do SW)
              → POST /api/notifications/[id]/read | read-all | ack
```

**Princípio fundamental**: o restante do sistema chama apenas `notify({ userId, type, ... })` e **nunca fala direto com um canal**. Toda a lógica de "qual canal, quando, com que prioridade" vive no módulo `lib/notifications`.

---

## 3. Modelo de dados (Prisma)

Adicionar ao `prisma/schema.prisma`:

```prisma
enum NotificationType {
  SERVICE_UPCOMING
  SERVICE_FINISH_REMINDER
  DEMAND_CREATED
  DEMAND_SCHEDULE_CHANGED
  DEMAND_STATUS_CHANGED
  DEMAND_CANCELLED
  DEMAND_DESCRIPTION_CHANGED
  DEMAND_DELETED
  DEMAND_ACK_CONFIRMED
  DEMAND_UNSEEN_ESCALATION
}

enum NotificationPriority {
  NORMAL
  CRITICAL
}

enum NotificationChannel {
  PUSH
  EMAIL
}

enum DeliveryStatus {
  PENDING
  SENT
  FAILED
  CANCELLED
}

model User {
  // ...campos existentes (id, name, role, passwordHash, createdAt, updatedAt)...
  email              String?             @unique   // NOVO — opcional (canal e-mail)

  // ...relações existentes...
  notifications      Notification[]
  pushSubscriptions  PushSubscription[]
}

model Notification {
  id          String               @id @default(cuid())
  userId      String
  type        NotificationType
  priority    NotificationPriority @default(NORMAL)
  title       String
  body        String
  demandId    String?                        // demanda de origem (null p/ eventos futuros sem demanda)
  data        Json?                          // payload extra: { url, tag }
  dedupeKey   String               @unique    // idempotência — ver §6.3
  readAt      DateTime?                      // estado LIDA
  ackAt       DateTime?                      // estado CONFIRMADA ("Ciente")
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  deliveries  NotificationDelivery[]

  @@index([userId, createdAt])
  @@index([demandId])
}

model NotificationDelivery {
  id              String             @id @default(cuid())
  notificationId  String
  channel         NotificationChannel
  status          DeliveryStatus     @default(PENDING)
  attempts        Int                @default(0)
  lastError       String?
  sentAt          DateTime?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  notification    Notification        @relation(fields: [notificationId], references: [id], onDelete: Cascade)

  @@index([notificationId])
  @@index([status])
}

model PushSubscription {
  id         String    @id @default(cuid())
  userId     String
  endpoint   String    @unique          // URL do push service (chave natural do dispositivo)
  p256dh     String                      // chave pública da subscription
  auth       String                      // segredo da subscription
  userAgent  String?                     // identificação do dispositivo (debug)
  revokedAt  DateTime?                   // revogação explícita (canal filtra revokedAt: null)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  lastSeenAt DateTime?

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Notas de decisão:**

- `readAt`/`ackAt` vivem em `Notification` (o usuário lê/confirma **a notificação**, não o canal). O delivery guarda o que é por canal: `status`, `attempts`, `lastError`, `sentAt`.
- `User.email` opcional + `@unique` (PostgreSQL permite múltiplos `NULL`). Normalizar no cadastro: trim + lowercase.
- `PushSubscription.endpoint @unique`: upsert por endpoint. Se outro usuário logar no mesmo navegador e ativar, a subscription é **reassociada** ao usuário atual.
- `PushSubscription.revokedAt`: reservado para revogação explícita (Fase 2). Na Fase 1 nada o define; o canal push consulta `revokedAt: null` e remove subscriptions expiradas (404/410) direto na tabela.
- Migration: `pnpm db:migrate` → nome sugerido: `notifications`.
- `onDelete: Cascade` em `PushSubscription` e `Notification` → remover usuário limpa tudo.

---

## 4. Módulo `lib/notifications`

Estrutura (conforme decisão da issue #10 — módulo isolado, extraível no futuro):

```
lib/notifications/
  types.ts          // NotificationInput, Priority, Channel, NotificationChannel (interface)
  content.ts        // buildNotificationContent(type, demand, context?) — títulos/corpos PT-BR (puro)
  events.ts         // seleção de eventos, dedupeKey, recipients, prioridade (puro)
  demand-events.ts  // notifyDemandEvent / notifyDemandAck — hooks best-effort das rotas
  dispatcher.ts     // notify(): idempotência, registros no banco, decisão de canais
  scheduler.ts      // dispatchPendingNotifications(): consultas + orquestração
  channels/
    push.ts         // NotificationChannel → web-push (VAPID)
    email.ts        // NotificationChannel → Brevo API v3
  __tests__/
    events.test.ts
    dispatcher.test.ts
    content.test.ts
    scheduler.test.ts
    demand-events.test.ts
```

> ⚠️ **Todo o módulo é server-only** (importa `@/lib/server/prisma`). Nunca importar de componente client.

### 4.1 `types.ts`

```ts
export type Channel = "PUSH" | "EMAIL"
export type Priority = "NORMAL" | "CRITICAL"

export type DemandEventType =
  | "DEMAND_CREATED"
  | "DEMAND_SCHEDULE_CHANGED"
  | "DEMAND_STATUS_CHANGED"
  | "DEMAND_CANCELLED"
  | "DEMAND_DESCRIPTION_CHANGED"
  | "DEMAND_DELETED"

export type NotificationEventType =
  | "SERVICE_UPCOMING"
  | "SERVICE_FINISH_REMINDER"
  | DemandEventType
  | "DEMAND_ACK_CONFIRMED"
  | "DEMAND_UNSEEN_ESCALATION"

export type NotificationContent = {
  title: string
  body: string
  url: string          // para onde o clique leva
  tag?: string         // agrupa/substitui notificações no Android (por demanda+evento)
}

export type NotificationInput = {
  userId: string
  type: NotificationEventType
  priority: Priority
  demandId?: string
  content: NotificationContent
  dedupeKey: string
}

export type ChannelSendInput = {
  userId: string
  content: NotificationContent
  demandId?: string
  priority: Priority   // o push usa para `requireInteraction`
}

export type ChannelSendResult = {
  channel: Channel
  ok: boolean
  error?: string
}

export interface NotificationChannel {
  readonly channel: Channel
  send(input: ChannelSendInput): Promise<ChannelSendResult>
}

export type NotifyResult = {
  skipped: boolean          // true = já existia (idempotência)
  notificationId: string
  channels: Channel[]       // canais efetivamente utilizados
}
```

### 4.2 `events.ts` (funções puras — alvo de testes)

```ts
export const buildDedupeKey = (
  type: NotificationEventType,
  demandId: string,
  userId: string
): string => `${type}:${demandId}:${userId}`

// Demandas dentro da janela do lembrete de início
export const isUpcomingCandidate = (
  demand: { status: DemandStatus; deletedAt: Date | null; inicioPrevisto: Date },
  now: Date,
  windowMinutes: number
): boolean =>
  demand.deletedAt === null &&
  (demand.status === DemandStatus.PENDING || demand.status === DemandStatus.IN_PROGRESS) &&
  demand.inicioPrevisto > now &&
  demand.inicioPrevisto <= addMinutes(now, windowMinutes)

// Demandas com fim previsto vencido e ainda não finalizadas
export const isOverdueCandidate = (
  demand: { status: DemandStatus; deletedAt: Date | null; fimPrevisto: Date },
  now: Date
): boolean =>
  demand.deletedAt === null &&
  (demand.status === DemandStatus.PENDING || demand.status === DemandStatus.IN_PROGRESS) &&
  demand.fimPrevisto < now

// Técnico + participantes, sem duplicar quem é os dois
export const resolveRecipients = (
  demand: { technician: User; participants: Array<{ user: User }> }
): User[] => // dedupe por id → [technician, ...participants.map(p => p.user)]

// ── Fase 1.5 (issue #12) ────────────────────────────────────────────────────

// Os 6 eventos de mutação de demanda (escalonáveis quando não lidos)
export const DEMAND_EVENT_TYPES = [
  "DEMAND_CREATED", "DEMAND_SCHEDULE_CHANGED", "DEMAND_STATUS_CHANGED",
  "DEMAND_CANCELLED", "DEMAND_DESCRIPTION_CHANGED", "DEMAND_DELETED",
] as const satisfies readonly DemandEventType[]

export const addHours = (date: Date, hours: number): Date =>
  new Date(date.getTime() + hours * 3_600_000)

// Bucket de hora para dedupeKey recorrente (determinístico, sem fuso)
export const hourBucket = (date: Date): number => Math.floor(date.getTime() / 3_600_000)

// Destinatários sem o autor da ação (quem fez não precisa ser notificado)
export const excludeActor = <T extends { id: string }>(recipients: T[], actorId: string): T[] =>
  recipients.filter((recipient) => recipient.id !== actorId)

// Prioridade centralizada (decisão do stakeholder: tudo CRITICAL exceto ack).
// Futuro (urgência por demanda): mudar APENAS aqui.
export const resolvePriority = (type: NotificationEventType): Priority =>
  type === "DEMAND_ACK_CONFIRMED" ? "NORMAL" : "CRITICAL"

// dedupeKey de evento de demanda: única por mutação (version sobe a cada update)
export const buildDemandEventDedupeKey = (
  type: DemandEventType, demandId: string, userId: string, version: number
): string => `${type}:${demandId}:${userId}:v${version}`

// dedupeKey recorrente: única por hora (re-disparo do lembrete de finalização)
export const buildRecurringDedupeKey = (
  type: NotificationEventType, demandId: string, userId: string, bucket: number
): string => `${type}:${demandId}:${userId}:${bucket}`

// Notificação de evento de demanda elegível a escalonamento
// (não lida há thresholdHours, demanda ativa)
export const isEscalationCandidate = (
  notification: { type: NotificationEventType; readAt: Date | null; createdAt: Date },
  demand: { status: DemandStatus; deletedAt: Date | null },
  now: Date,
  thresholdHours: number
): boolean =>
  notification.readAt === null &&
  (DEMAND_EVENT_TYPES as readonly string[]).includes(notification.type) &&
  demand.deletedAt === null &&
  (demand.status === DemandStatus.PENDING || demand.status === DemandStatus.IN_PROGRESS) &&
  notification.createdAt.getTime() <= now.getTime() - thresholdHours * 3_600_000
```

> `isOverdueCandidate` ganhou um 3º parâmetro **opcional** `maxHours` (teto do re-disparo): `isOverdueCandidate(demand, now, maxHours?)` — sem o parâmetro, o comportamento antigo é preservado.

### 4.3 `content.ts` (função pura — alvo de testes)

```ts
export type DemandEventContext = {
  actorName?: string      // quem fez a alteração (eventos de demanda)
  statusLabel?: string    // "Pendente" | "Em Andamento" | ... (demandStatusFromDb)
  userName?: string       // quem clicou "Ciente" (ack)
  unseenUserName?: string // destinatário que não leu a notificação (escalonamento)
  unseenHours?: number    // horas sem leitura (escalonamento)
}

export const buildNotificationContent = (
  type: NotificationEventType,
  demand: Pick<Demand, "id" | "descricao" | "local" | "inicioPrevisto">,
  context: DemandEventContext = {}
): NotificationContent
```

| Tipo | `title` | `body` | `tag` |
|---|---|---|---|
| `SERVICE_UPCOMING` | `Serviço começa em instantes` | `${local} — ${descricao} (início previsto às HH:mm)` | `SERVICE_UPCOMING:{demandId}` |
| `SERVICE_FINISH_REMINDER` | `Serviço pendente de finalização` | `"${descricao}" passou do horário de fim previsto. Finalize no sistema.` | `SERVICE_FINISH_REMINDER:{demandId}` |
| `DEMAND_CREATED` | `Novo chamado atribuído a você` | `${local} — ${descricao} (início previsto às HH:mm). Confira a duração prevista.` | `DEMAND_CREATED:{demandId}` |
| `DEMAND_SCHEDULE_CHANGED` | `Horário do chamado alterado` | `"${descricao}" (${local}): horário alterado por ${actorName}. Confira o novo horário.` | `DEMAND_SCHEDULE_CHANGED:{demandId}` |
| `DEMAND_STATUS_CHANGED` | `Status do chamado alterado` | `"${descricao}" (${local}): novo status ${statusLabel} (alterado por ${actorName}).` | `DEMAND_STATUS_CHANGED:{demandId}` |
| `DEMAND_CANCELLED` | `Chamado cancelado` | `"${descricao}" (${local}) foi cancelado por ${actorName}.` | `DEMAND_CANCELLED:{demandId}` |
| `DEMAND_DESCRIPTION_CHANGED` | `Descrição do chamado alterada` | `"${descricao}" (${local}): descrição alterada por ${actorName}.` | `DEMAND_DESCRIPTION_CHANGED:{demandId}` |
| `DEMAND_DELETED` | `Chamado excluído` | `"${descricao}" (${local}) foi excluído por ${actorName}.` | `DEMAND_DELETED:{demandId}` |
| `DEMAND_ACK_CONFIRMED` | `Chamado confirmado pelo técnico` | `${userName} está ciente do chamado "${descricao}" (${local}).` | `DEMAND_ACK_CONFIRMED:{demandId}` |
| `DEMAND_UNSEEN_ESCALATION` | `Chamado ainda não visto` | `"${descricao}" (${local}) está há ${unseenHours}h sem ser visto por ${unseenUserName}. Considere ligar ou enviar mensagem.` | `DEMAND_UNSEEN_ESCALATION:{demandId}` |

- `url`: `"/dashboard"` (futuro: link direto ao dia/demanda).
- Horário: implementado com `Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })` — **fuso fixo** para que o horário exibido não mude conforme o fuso do servidor (container em UTC mostraria 11:00 para um serviço previsto às 08:00 no Brasil).
- `DEMAND_UNSEEN_ESCALATION`: `unseenHours` é a **idade real da não-leitura** (`floor` das horas decorridas desde `createdAt`, mínimo 1) — não o threshold de escalonamento. O nome exibido é do **destinatário que não leu** a notificação (pode ser um participante, não só o técnico).

### 4.4 `dispatcher.ts`

```ts
export const notify = async (input: NotificationInput): Promise<NotifyResult> => {
  // 1. Idempotência: findUnique({ dedupeKey }) → se existir, retorna { skipped: true }
  //    (a unique constraint é a rede de segurança contra corrida — capturar P2002 do Prisma)
  //
  // 2. prisma.notification.create({ userId, type, priority, title, body,
  //       demandId, data: { url, tag }, dedupeKey })
  //
  // 3. Carregar destinatário: user (email) + pushSubscriptions ativas (revokedAt: null)
  //
  // 4. decideChannels({ hasPushSubscriptions, hasEmail, priority }): Channel[]
  //       CRITICAL → push E e-mail (cada um se disponível); NORMAL → push, senão e-mail; sem ambos → []
  //
  // 5. Para cada canal:
  //       delivery = prisma.notificationDelivery.create({ channel, status: PENDING })
  //       result = await channelImpl.send({ userId, content, demandId, priority })
  //       (send envolvido em try/catch: exceção inesperada vira FAILED — delivery nunca fica PENDING)
  //       delivery.update({ status: result.ok ? "SENT" : "FAILED",
  //                         attempts: { increment: 1 }, lastError: result.error,
  //                         sentAt: result.ok ? new Date() : null })
  //
  // 6. return { skipped: false, notificationId, channels }
}

// Decisão de canais (função pura, alvo de testes)
export const decideChannels = (input: {
  hasPushSubscriptions: boolean
  hasEmail: boolean
  priority: Priority
}): Channel[] => {
  if (input.priority === "CRITICAL") {
    const channels: Channel[] = []
    if (input.hasPushSubscriptions) channels.push("PUSH")
    if (input.hasEmail) channels.push("EMAIL")
    return channels
  }
  return input.hasPushSubscriptions ? ["PUSH"] : input.hasEmail ? ["EMAIL"] : []
}
```

### 4.5 `channels/push.ts` (web-push)

```ts
import webpush from "web-push"

// Configurar VAPID de forma lazy (não no top-level do módulo),
// para não quecarar importação em testes sem env — configurar uma vez.
let vapidConfigured = false
const configureVapid = () => {
  if (vapidConfigured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  vapidConfigured = true
}

export const pushChannel: NotificationChannel = {
  channel: "PUSH",
  async send({ userId, content, priority }) {
    configureVapid()
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId, revokedAt: null },
    })
    if (subscriptions.length === 0) {
      return { channel: "PUSH", ok: false, error: "Nenhuma subscription ativa" }
    }
    const payload = JSON.stringify({
      ...content,                              // title, body, url, tag
      requireInteraction: priority === "CRITICAL", // fica fixa na bandeja até ser tratada
    })
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      )
    )
    // Para cada rejeição com err.statusCode 404 ou 410 (subscription expirou/inválida):
    //   prisma.pushSubscription.delete({ where: { endpoint } })  — limpeza automática
    // ok = true se AO MENOS UMA subscription recebeu
  },
}
```

**Dependências**: `web-push` (runtime) + `@types/web-push` (dev).

**Chaves VAPID**: script `scripts/generate-vapid-keys.mjs` (usa `webpush.generateVAPIDKeys()`), exposto como `pnpm run push:generate-keys`.

### 4.6 `channels/email.ts` (Brevo)

Sem SDK — `fetch` direto na API v3:

```ts
export const emailChannel: NotificationChannel = {
  channel: "EMAIL",
  async send({ userId, content }) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user?.email) return { channel: "EMAIL", ok: false, error: "Usuário sem e-mail cadastrado" }

    const apiKey = process.env.BREVO_API_KEY
    if (!apiKey) return { channel: "EMAIL", ok: false, error: "BREVO_API_KEY não configurada" }
    if (!process.env.BREVO_SENDER_EMAIL) return { channel: "EMAIL", ok: false, error: "BREVO_SENDER_EMAIL não configurada" }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME || "SGDE",
          email: process.env.BREVO_SENDER_EMAIL,
        },
        to: [{ email: user.email }],
        subject: content.title,
        textContent: content.body,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return { channel: "EMAIL", ok: false, error: `Brevo respondeu ${res.status}: ${body.slice(0, 200)}` }
    }
    return { channel: "EMAIL", ok: true }
  },
}
```

> **Importante (contexto da issue)**: já testamos o WhatsApp da Brevo e o remetente sai como número americano. Isso foi motivo de descarte para WhatsApp. Para **e-mail** não há esse problema. A validação de remetente +55 é critério apenas para o canal WhatsApp (Fase 3).

### 4.7 `scheduler.ts`

```ts
export const dispatchPendingNotifications = async (now = new Date()) => {
  const windowMinutes = resolveWindowMinutes()      // NOTIFY_UPCOMING_MINUTES (default 15)
  const finishMaxHours = resolveFinishMaxHours()    // NOTIFY_FINISH_MAX_HOURS (default 24)

  const demands = await prisma.demand.findMany({
    where: {
      deletedAt: null,
      status: { in: [DemandStatus.PENDING, DemandStatus.IN_PROGRESS] },
      OR: [
        { inicioPrevisto: { gt: now, lte: addMinutes(now, windowMinutes) } },  // janela upcoming: (now, now+windowMinutes]
        { fimPrevisto: { lt: now, gt: addHours(now, -finishMaxHours) } },      // overdue com teto
      ],
    },
    include: { technician: true, participants: { include: { user: true } } },
  })

  let dispatched = 0
  let skipped = 0
  let failed = 0

  for (const demand of demands) {
    // ANTI-CORRIDA: re-buscar a demanda antes de notificar; se virou DONE/CANCELLED/deleted → continuar
    const fresh = await prisma.demand.findUnique({ where: { id: demand.id } })
    if (!fresh || fresh.deletedAt || fresh.status === DemandStatus.DONE || fresh.status === DemandStatus.CANCELLED) continue

    const upcoming = isUpcomingCandidate(demand, now, windowMinutes)
    const overdue = isOverdueCandidate(demand, now, finishMaxHours)

    for (const recipient of resolveRecipients(demand)) {
      if (upcoming) {
        const r = await notify({
          userId: recipient.id,
          type: "SERVICE_UPCOMING",
          priority: resolvePriority("SERVICE_UPCOMING"),
          demandId: demand.id,
          content: buildNotificationContent("SERVICE_UPCOMING", demand),
          dedupeKey: buildDedupeKey("SERVICE_UPCOMING", demand.id, recipient.id),
        })
        r.skipped ? skipped++ : dispatched++  // failed++ quando notify() lança (try/catch por evento)
      }
      if (overdue) {
        const r = await notify({
          userId: recipient.id,
          type: "SERVICE_FINISH_REMINDER",
          priority: resolvePriority("SERVICE_FINISH_REMINDER"),
          demandId: demand.id,
          content: buildNotificationContent("SERVICE_FINISH_REMINDER", demand),
          dedupeKey: buildRecurringDedupeKey("SERVICE_FINISH_REMINDER", demand.id, recipient.id, hourBucket(now)),
        })
        r.skipped ? skipped++ : dispatched++
      }
    }
  }

  // Escalonamento de não-lidas ao criador (ver §6.7)
  const escalation = await escalateUnseenNotifications(now)

  return {
    dispatched, skipped, failed,
    escalated: escalation.dispatched,
    escalatedSkipped: escalation.skipped,
    escalatedFailed: escalation.failed,
  }
}
```

> **Contadores**: `dispatched` = notificação nova criada; `skipped` = já existia (idempotência); `failed` = `notify()` lançou exceção (cada chamada é isolada em try/catch para não abortar a varredura). Falhas de canal não lançam — viram delivery `FAILED` e contam como `dispatched`. `escalated` = escalonamento novo criado; `escalatedSkipped` = escalonamento já existia (dedupe por `notificationId`); `escalatedFailed` = `notify()` do escalonamento lançou exceção (isolado em try/catch).

### 4.8 `demand-events.ts` (hooks das rotas — best-effort)

Orquestração que as rotas chamam **depois** da operação principal e **antes** do `return jsonOk(...)`. Nunca lança (falha de notificação não derruba a rota):

```ts
// Notifica técnico + participantes (menos o autor) sobre um evento de demanda
export const notifyDemandEvent = async (input: {
  type: DemandEventType
  demand: { id, version, descricao, local, inicioPrevisto, technician, participants }
  actorId: string
  actorName: string
  statusLabel?: string
}): Promise<void>

// Notifica o CRIADOR da demanda que o eletricista confirmou ("Ciente")
export const notifyDemandAck = async (input: {
  notificationId: string
  demandId: string
  ackUserId: string
  ackUserName: string
}): Promise<void>
```

- `notifyDemandEvent`: destinatários = `excludeActor(resolveRecipients(demand), actorId)`; `priority = resolvePriority(type)`; `dedupeKey = buildDemandEventDedupeKey(type, demandId, userId, demand.version)`; cada destinatário em try/catch próprio (um erro não aborta os demais).
- `notifyDemandAck`: busca a demanda; se `createdById === ackUserId` ou demanda inexistente → no-op; `dedupeKey = DEMAND_ACK_CONFIRMED:${notificationId}:${createdById}` (uma vez por notificação confirmada).

---

## 5. Contratos de API

Todos seguem o padrão atual: helpers `jsonOk`/`jsonError` (`lib/server/http.ts`), `requireAuth()` e `validateCsrf()` em mutações. Mensagens de erro em PT-BR, códigos UPPER_SNAKE_CASE. Os códigos `VAPID_NOT_CONFIGURED` e `CRON_NOT_CONFIGURED` foram adicionados ao union `ApiErrorCode` de `lib/server/http.ts`.

### 5.1 Subscriptions de push

**`GET /api/push/vapid-public-key`** (auth)
```json
{ "success": true, "data": { "publicKey": "BCn1..." } }
```
*Se `VAPID_PUBLIC_KEY` não estiver configurada → 500 `VAPID_NOT_CONFIGURED` (mensagem clara para o dev).*

**`POST /api/push/subscribe`** (auth + CSRF)
```json
// body (Zod): { "endpoint": "https://fcm.googleapis.com/...", "keys": { "p256dh": "...", "auth": "..." }, "userAgent": "Mozilla/5.0 ..." }
{ "success": true, "data": { "subscriptionId": "clx..." } }
```
- `upsert` por `endpoint` (único). Se o endpoint já existir, atualiza `userId` (reassocia dispositivo), `p256dh`, `auth`, `userAgent`, `updatedAt`.
- Validação Zod: `endpoint` URL https, `keys.p256dh`/`keys.auth` não vazios, `userAgent` opcional string ≤ 500.

**`DELETE /api/push/subscribe`** (auth + CSRF)
```json
// body (Zod): { "endpoint": "https://fcm.googleapis.com/..." }
{ "success": true, "data": { "deleted": true } }
```
- Deleta somente onde `endpoint` **e** `userId` batem (usuário não remove subscription de outro).

### 5.2 Inbox de notificações

**`GET /api/notifications`** (auth) — últimas 50 do usuário logado (`readAt: null` primeiro? Não: `createdAt desc` simples)
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "clx...",
        "type": "SERVICE_UPCOMING",
        "priority": "NORMAL",
        "title": "Serviço começa em instantes",
        "body": "Subestação X — Manutenção preventiva (início previsto às 08:00)",
        "demandId": "clx...",
        "data": { "url": "/dashboard", "tag": "SERVICE_UPCOMING:clx..." },
        "createdAt": "2026-10-24T10:45:00.000Z",
        "readAt": null,
        "ackAt": null,
        "deliveries": [{ "channel": "PUSH", "status": "SENT", "sentAt": "2026-10-24T10:45:01.000Z" }]
      }
    ],
    "unreadCount": 1
  }
}
```

**`GET /api/notifications/unread-count`** (auth)
```json
{ "success": true, "data": { "unreadCount": 3 } }
```

**`POST /api/notifications/[id]/read`** (auth + CSRF) — marca `readAt = now` (idempotente: já lida → 200 sem efeito). Só o dono (de outro usuário → 404 `NOT_FOUND`, sem vazar existência).
```json
{ "success": true, "data": { "notificationId": "clx...", "readAt": "2026-10-24T10:50:00.000Z" } }
```

**`POST /api/notifications/read-all`** (auth + CSRF) — `updateMany({ userId, readAt: null })` → `{ "updatedCount": N }`.

**`POST /api/notifications/[id]/ack`** (auth + CSRF) — botão "Ciente": seta `ackAt = now` e `readAt` (se null).
```json
{ "success": true, "data": { "notificationId": "clx...", "ackAt": "2026-10-24T10:52:00.000Z", "readAt": "2026-10-24T10:50:00.000Z" } }
```

### 5.3 Agendador

**`POST /api/cron/dispatch-notifications`** — proteção por token (header `x-cron-token` == `CRON_SECRET`):

```json
{ "success": true, "data": { "dispatched": 2, "skipped": 1, "failed": 0, "escalated": 1, "escalatedSkipped": 0, "escalatedFailed": 0 } }
```

- `escalated` / `escalatedSkipped` / `escalatedFailed`: escalonamentos de não-lidas criados / já existentes (dedupe) / com falha no `notify()` na varredura — ver §6.7.

- Comparação **timing-safe** (hash SHA-256 de ambos + `crypto.timingSafeEqual` — tolera tamanhos diferentes).
- `CRON_SECRET` ausente no servidor → 500 `CRON_NOT_CONFIGURED` (fail closed).
- Token inválido/ausente → 401 `UNAUTHORIZED`.
- Sem CSRF (não é chamado pelo browser; a autenticação é o token secreto).

### 5.4 Cancelamento automático (hook no fluxo existente)

Em `app/api/demands/[id]/status/route.ts`, **após** o update bem-sucedido, se `nextStatus` for `DONE` ou `CANCELLED`:

```ts
await prisma.notificationDelivery.updateMany({
  where: {
    status: "PENDING",
    notification: { demandId: demand.id },
  },
  data: { status: "CANCELLED" },
})
```

Isso garante que deliveries ainda não disparados pelo agendador nunca saiam. Pushes já enviados não podem ser "desenviados" (limitação da plataforma) — mas o item some do fluxo de envios futuros.

> **ORDEM CRÍTICA**: este bloco roda **antes** do hook de notificação do evento de status (`notifyDemandEvent` — ver §6.8). Se o hook viesse primeiro, o delivery da notificação nova nasceria `PENDING` e seria cancelado pelo `updateMany` logo em seguida.

---

## 6. Agendador e eventos

### 6.1 Gatilho

Coolify **Scheduled Task** chama `POST /api/cron/dispatch-notifications` a cada 1 minuto (ver §10). Sem cron interno no app (`setInterval` em Next.js é instável entre restarts/instâncias).

### 6.2 Janela do `SERVICE_UPCOMING`

- `NOTIFY_UPCOMING_MINUTES` (default `15`): notifica demandas com `inicioPrevisto` em `(now, now+15min]`.
- **Início já passado** → não notifica (lembrete atrasado não ajuda e a janela foi pensada para "antes do início").
- Demandas criadas de última hora (ex.: início em 10 min) disparam na próxima varredura — comportamento correto.

### 6.3 Idempotência

- `dedupeKey` é único por notificação; o dispatcher checa antes de criar e a constraint `@unique` é a rede de segurança se duas varreduras coincidirem (erro P2002 do Prisma tratado como `skipped`).
- Formatos:
  - `SERVICE_UPCOMING`: `${type}:${demandId}:${userId}` — único para sempre.
  - Eventos de demanda: `${type}:${demandId}:${userId}:v${version}` — única **por mutação** (a `version` sobe a cada update; sem ela, a segunda mudança de status nunca notificaria).
  - `SERVICE_FINISH_REMINDER` (recorrente): `${type}:${demandId}:${userId}:${hourBucket}` — re-dispara a cada 1h, idempotente dentro da hora.
  - `DEMAND_ACK_CONFIRMED`: `DEMAND_ACK_CONFIRMED:${notificationId}:${createdById}` — uma vez por notificação confirmada.
  - `DEMAND_UNSEEN_ESCALATION`: `DEMAND_UNSEEN_ESCALATION:${notificationId}:${createdById}` — uma vez por notificação não vista.
- Resultado: **o mesmo evento nunca é enviado duas vezes** para a mesma demanda/usuário — mesmo com curl manual repetido.

### 6.4 Escalonamento de corrida (race)

Entre a consulta e o envio, a demanda pode virar `DONE`/`CANCELLED`. O scheduler **re-verifica o status** antes de cada `notify()` (ver §4.7). O updateMany de §5.4 é a segunda camada (para deliveries PENDING criados mas ainda não processados).

### 6.5 Quem recebe

- **Eventos de serviço/demanda** (`SERVICE_*` + mutações `DEMAND_*`): técnico responsável + participantes (dedupe por `id` — o técnico pode também ser participante), **exceto o autor da ação** (`excludeActor`).
- **Loop do gestor**: somente o **criador da demanda** (`createdById`) recebe `DEMAND_ACK_CONFIRMED` (no "Ciente") e `DEMAND_UNSEEN_ESCALATION` (não-lida) — não todos os gestores.

### 6.6 Recorrência do lembrete de finalização

- Enquanto a demanda estiver vencida (`fimPrevisto < now`) e ativa (`PENDING`/`IN_PROGRESS`), o lembrete re-dispara **a cada 1h** — `dedupeKey` com bucket de hora (`hourBucket(now)`), idempotente dentro da hora.
- **Teto**: `NOTIFY_FINISH_MAX_HOURS` (padrão 24) — demanda vencida há mais de 24h para de gerar lembretes (o escalonamento cobre o sinal de "abandonada").
- Para quando a demanda é concluída/cancelada: cancelamento automático de deliveries `PENDING` (§5.4) + re-verificação de status do scheduler (§6.4).

### 6.7 Escalonamento de não-lidas (loop do gestor)

- A cada varredura, o scheduler parte das **demandas ativas** (a `Notification` não tem relação Prisma com `Demand` — só `demandId` escalar) e busca notificações de eventos de demanda **não lidas** há ≥ `NOTIFY_ESCALATION_HOURS` (padrão 2).
- Para cada notificação elegível (`isEscalationCandidate`), o **criador da demanda** recebe `DEMAND_UNSEEN_ESCALATION` — uma vez por notificação (`dedupeKey` por `notificationId`).
- O criador não escala a si mesmo (notificação cujo destinatário é o próprio criador é ignorada).
- O escalonamento consulta as notificações em **uma única query** (sem N+1 — o cron varre a cada minuto) e a resposta do cron inclui `escalatedFailed` (falha no `notify()` do escalonamento).

### 6.8 Gatilhos por rota (hooks best-effort)

| Evento | Rota | Hook |
|---|---|---|
| `DEMAND_CREATED` | `POST /api/demands` | `notifyDemandEvent` após o create |
| `DEMAND_SCHEDULE_CHANGED` | `PATCH /api/demands/[id]/schedule` | `notifyDemandEvent` após a `$transaction` |
| `DEMAND_STATUS_CHANGED` / `DEMAND_CANCELLED` | `PATCH /api/demands/[id]/status` | `notifyDemandEvent` **depois** do cancelamento de deliveries `PENDING` (§5.4) |
| `DEMAND_DESCRIPTION_CHANGED` | `PATCH /api/demands/[id]` | `notifyDemandEvent` após o update |
| `DEMAND_DELETED` | `DELETE /api/demands/[id]` | re-busca com includes após o soft-delete + `notifyDemandEvent` |
| `DEMAND_ACK_CONFIRMED` | `POST /api/notifications/[id]/ack` | `notifyDemandAck` **somente na primeira confirmação** (`ackAt === null` antes do update) |

> Todos os hooks são **best-effort**: falha no envio nunca derruba a operação principal da rota (try/catch que só loga).

---

## 7. PWA: manifest, service worker e ícones

### 7.1 Manifest — `app/manifest.ts`

Next.js App Router serve automaticamente em `/manifest.webmanifest`:

```ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SGDE — Sistema de Gestão de Demandas Elétricas",
    short_name: "SGDE",
    description: "Gestão de demandas elétricas da Bagattoli Tech",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#09090b",   // ajustar ao tema (globals.css)
    theme_color: "#09090b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
```

Em `app/layout.tsx`: adicionar `manifest: "/manifest.webmanifest"` ao `metadata` e `themeColor` ao `viewport` export.

### 7.2 Service worker — `public/sw.js`

Arquivo estático vanilla JS (sem build). Escopo `/` por padrão:

```js
self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

// Handler no-op: requisito de instalabilidade do PWA no Chrome
// (não fazemos cache offline no MVP — evita complexidade de invalidação)
self.addEventListener("fetch", () => {})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {} // push do DevTools vem sem payload — deve degradar graciosamente
  }
  const url = data.url || "/dashboard"
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || "SGDE", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag, // substitui notificação anterior do mesmo evento/demanda
        data: { url },
        requireInteraction: Boolean(data.requireInteraction),
      })
      // Avisa abas abertas para atualizar o contador do sino
      const clients = await self.clients.matchAll({ type: "window" })
      for (const client of clients) {
        client.postMessage({ type: "NOTIFICATION_RECEIVED" })
      }
    })()
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const url = event.notification.data?.url || "/dashboard"
      const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      const existing = clientsArr.find((client) => client.url.includes(url))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })()
  )
})
```

### 7.3 Registro do SW — `components/push/register-sw.tsx`

```tsx
"use client"
import { useEffect } from "react"

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
  }, [])
  return null
}
```

Montar dentro de `app/layout.tsx` (junto ao `ThemeProvider`).

### 7.4 Ícones — `scripts/generate-icons.mjs`

Gerar a partir do logo existente (`public/bagattoli-tech-logo.png`) com `sharp` (devDependency):

- `public/icons/icon-192.png` e `public/icons/icon-512.png` — logo centrada (90%) em fundo sólido
- `public/icons/icon-192-maskable.png` e `public/icons/icon-512-maskable.png` — com safe area (~75% de conteúdo, pois o Android pode recortar em formas variadas)

> **Fundo dos ícones**: o logo é escuro (preto + verde-lima) e ficaria ilegível sobre o fundo escuro `#09090b` do manifest; os ícones usam fundo branco (`#ffffff`, `--background` do tema claro) para manter a marca legível. As cores do manifest permanecem `#09090b`.

Script npm: `"icons:generate": "node scripts/generate-icons.mjs"`. Os PNGs gerados **entram no commit** (o script serve para regenerar quando a arte mudar). Arte-final pode substituir depois — os caminhos são o contrato.

### 7.5 Headers — `next.config.mjs`

Adicionar header para o SW nunca ficar preso em cache agressivo de CDN:

```js
{
  source: "/sw.js",
  headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
}
```

---

## 8. UI: sino, painel de notificações e ativação

### 8.1 Componentes

| Arquivo | Papel |
|---|---|
| `components/organisms/notifications-bell.tsx` | Sino no header + badge de não lidas + painel (shadcn `popover`) com lista, "Ciente", "Marcar todas como lidas" e seção de ativação |
| `hooks/use-notifications.ts` | Poll de `unread-count` (60s) + refresh em focus + refresh via mensagem do SW (`NOTIFICATION_RECEIVED`); ações `markRead`, `readAll`, `ack`; carrega lista ao abrir o painel |
| `lib/push.ts` (client helper) | `urlBase64ToUint8Array`, `subscribeToPush(publicKey)` (permission + subscribe + `toJSON()`), `unsubscribeFromPush()` |

Helpers client usam o `lib/api.ts` existente (que já lida com cookies/CSRF — verificar como o header CSRF é injetado e reutilizar).

### 8.2 Onde monta

`components/organisms/dashboard-hero.tsx` (header sticky global) recebe `<NotificationsBell />` no lado direito, próximo ao menu do usuário. Como o hero é usado no dashboard e em `/dashboard/users`, o sino aparece em todas as telas logadas. O sino gerencia **apenas estado local próprio** (não é estado global do template — respeita a convenção atômica do projeto).

### 8.3 Fluxo de ativação (por dispositivo)

```
Estado possíveis do navegador:
  unsupported     → sem "serviceWorker" ou sem "PushManager" → painel esconde a seção
  default (não perguntado) → botão "Ativar notificações"
  granted + subscribed     → "✓ Notificações ativas neste dispositivo" + botão "Desativar"
  denied                   → texto: "Notificações bloqueadas neste navegador. Libere as permissões de
                              notificações deste site nas configurações do navegador" (texto simples, sem link —
                              navegadores bloqueiam navegação para chrome://; o painel cita o caminho
                              chrome://settings/content/notifications para digitar na barra de endereço)
```

Ativar:
1. `Notification.requestPermission()` → se não `granted`, atualizar estado (sem throw).
2. `navigator.serviceWorker.ready` → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, chave buscada de `GET /api/push/vapid-public-key`.
3. `POST /api/push/subscribe` com o resultado de `subscription.toJSON()`.

Desativar: `subscription.unsubscribe()` (browser) + `DELETE /api/push/subscribe` (banco).

### 8.4 Painel (popover)

- Lista: título, corpo, tempo relativo ("há 5 min"), item não lido em destaque.
- Clique no item → `POST .../read` + navegar para `data.url` (dashboard).
- Botão **"Ciente"** por item (grava `ackAt`; visível em todas as notificações).
- "Marcar todas como lidas" → `POST .../read-all`.

> **Hook do ack**: na **primeira** confirmação (`ackAt === null` antes do update), a rota chama `notifyDemandAck` — o **criador da demanda** recebe `DEMAND_ACK_CONFIRMED` (§6.8). Confirmações repetidas não re-notificam.

### 8.5 E-mail no CRUD de usuários (campo opcional)

- `lib/server/users.ts`: `email` opcional no schema Zod (formato email, trim + lowercase, máx 254, único). String vazia é aceita e significa "sem e-mail".
- `app/api/users` (POST/PATCH): persiste o campo; no PATCH, `""` limpa para `null`; e-mail duplicado → 409 `CONFLICT` (P2002 com `meta.target` contendo `email`); formato inválido → 422.
- `components/organisms/user-modal.tsx` + `users-list.tsx`: campo "E-mail (para notificações)" opcional com validação inline; a lista exibe o e-mail quando cadastrado.
- Se o gestor não preencher, apenas não recebe fallback de e-mail (push continua funcionando).

---

## 9. Variáveis de ambiente

Adicionar ao `.env.example` (e documentar no deploy):

```bash
# ── Notificações push (Web Push PWA) ────────────────────────────────────────
# Gere com: pnpm run push:generate-keys
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
# Contato exigido pelo padrão VAPID (mailto: ou https:)
VAPID_SUBJECT="mailto:contato@bagattolitech.com.br"

# Token secreto chamado pelo agendador (Coolify Scheduled Task).
# Gere com: openssl rand -hex 32
CRON_SECRET=""

# Janela do lembrete de início, em minutos antes de inicioPrevisto (padrão: 15)
NOTIFY_UPCOMING_MINUTES="15"

# Escalonamento ao gestor: horas sem leitura até notificar o criador da demanda (padrão: 2)
NOTIFY_ESCALATION_HOURS="2"

# Re-disparo do lembrete de finalização: teto em horas após o fim previsto (padrão: 24)
NOTIFY_FINISH_MAX_HOURS="24"

# ── Canal e-mail (Brevo) — fallback quando não há push ativo ───────────────
BREVO_API_KEY=""
BREVO_SENDER_EMAIL=""
BREVO_SENDER_NAME="SGDE"
```

**Regra de troca de chaves VAPID**: se `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` mudarem, **todas** as subscriptions existentes ficam inválidas (assinadas com a chave antiga). Nesse caso, limpar a tabela `PushSubscription` e pedir reativação aos eletricistas. Registrar isso no runbook de deploy.

---

## 10. Deploy: Coolify Scheduled Task

1. No Coolify, abrir o recurso do SGDE → **Scheduled Tasks** (ou *Cron Jobs*) → **Add new**.
2. Configurar:

   | Campo | Valor |
   |---|---|
   | Name | `sgde-dispatch-notifications` |
   | Command | `curl -fsS -X POST -H "x-cron-token: $CRON_SECRET" https://<dominio-do-sgde>/api/cron/dispatch-notifications` |
   | Frequency | `* * * * *` (a cada minuto) |
   | Run in / container | A mesma instância do app (o env `CRON_SECRET` fica disponível no container) |

   - Se a Scheduled Task do Coolify não rodar no container do app, substituir `$CRON_SECRET` pelo valor literal no comando.
   - `curl -fsS`: falha silenciosa vira erro visível nos logs da task.

3. **Verificação**: nos logs da task deve aparecer a resposta `{"success":true,"data":{"dispatched":0,"skipped":0,"failed":0,"escalated":0,"escalatedSkipped":0,"escalatedFailed":0}}` (ou contadores > 0 quando houver eventos). Chamar manualmente uma vez (§11.3) para validar o token.

4. Garantir que as variáveis de `§9` estejam definidas no ambiente do app no Coolify (redeploy após adicionar).

---

## 11. Guia prático de testes

### 11.1 Preparação (uma vez)

```bash
pnpm install

# 1. Gerar chaves VAPID e copiar para o .env
pnpm run push:generate-keys
# → imprime VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY

# 2. Gerar o token do agendador
openssl rand -hex 32        # → CRON_SECRET no .env

# 3. Aplicar a migration das notificações
pnpm db:migrate

# 4. (Opcional) ícones PWA
pnpm run icons:generate

# 5. Subir o app
pnpm dev
```

### 11.2 Testes automatizados (Jest)

```bash
pnpm test          # roda os testes novos + a suíte existente
pnpm typecheck     # TypeScript sem erros
pnpm lint          # ESLint ok
```

Cobertura esperada (detalhes em §4 e nos testes de `lib/notifications/__tests__/`):
- **Seleção de eventos**: dentro/fora da janela (inclusive limites), `DONE`/`CANCELLED`/deletadas excluídas, overdue detectado.
- **Dispatcher**: fallback para e-mail sem subscription, sem canais quando nada disponível, delivery SENT/FAILED conforme resultado do canal, idempotência (2ª chamada → `skipped`).
- **Purezas**: `buildDedupeKey`, `resolveRecipients` (técnico também participante → 1 notificação), `buildNotificationContent`.

### 11.3 Teste manual local — desktop (Chrome/Edge; `localhost` dispensa HTTPS)

> Pré-requisito: dois terminais logados — um **eletricista** (alvo das notificações) e um **gestor** (cria demandas). Para testar rápido, dá para criar demandas como gestor e logar o eletricista em outra janela anônima/navegador diferente.

1. **Ativar as notificações** — como eletricista, clicar no sino no header → "Ativar notificações" → permitir no prompt do navegador.
2. **Confirmar a subscription** — DevTools → *Application* → *Service Workers*: `sw.js` deve estar *activated*. No console da página:
   ```js
   navigator.serviceWorker.ready
     .then((r) => r.pushManager.getSubscription())
     .then((s) => console.log(JSON.stringify(s)))
   // → deve imprimir um objeto com "endpoint" e "keys"
   ```
3. **Testar o push do próprio DevTools** — *Application* → *Service Workers* → botão **"Push"**: envia um push **sem payload**. O SW deve mostrar a notificação padrão "SGDE" (valida o handler sem depender do backend).
4. **Cenário `SERVICE_UPCOMING`** — como gestor, criar demanda atribuída ao eletricista com **início previsto em ~10 min** (dentro da janela de 15).
5. **Disparar o agendador manualmente** (simula o cron):
   ```bash
   curl -X POST http://localhost:3000/api/cron/dispatch-notifications \
     -H "x-cron-token: $CRON_SECRET"
   # → {"success":true,"data":{"dispatched":1,"skipped":0,"failed":0,"escalated":0,"escalatedSkipped":0,"escalatedFailed":0}}
   ```
   A notificação deve aparecer **mesmo com a aba do SGDE fechada** (o service worker persiste). Repita com a aba fechada de propósito.
6. **Idempotência** — rodar o mesmo curl de novo:
   ```bash
   # → {"success":true,"data":{"dispatched":0,"skipped":1,"failed":0,"escalated":0,"escalatedSkipped":0,"escalatedFailed":0}}
   ```
   Nenhuma notificação nova. Rodar 10× → mesmo resultado.
7. **Cenário `SERVICE_FINISH_REMINDER`** — criar demanda com `fimPrevisto` já vencido (status `PENDING`) → curl → notificação "Serviço pendente de finalização".
8. **Cancelamento automático** — concluir a demanda (status → `DONE`) e rodar o curl → nenhuma notificação nova; no banco, deliveries `PENDING` daquela demanda viram `CANCELLED`:
   ```bash
   psql "$DATABASE_URL" -c "SELECT channel, status, \"lastError\", \"sentAt\" FROM \"NotificationDelivery\" ORDER BY \"createdAt\" DESC LIMIT 10;"
   ```
9. **Token inválido** (segurança):
   ```bash
   curl -X POST http://localhost:3000/api/cron/dispatch-notifications \
     -H "x-cron-token: errado"
   # → 401
   curl -X POST http://localhost:3000/api/cron/dispatch-notifications
   # → 401
   ```
10. **Inbox + estados** — como eletricista: badge do sino mostra contador; abrir o painel; clicar em item → marca LIDA (badge decrementa); "Ciente" → grava confirmação; conferir no banco/`GET /api/notifications` os campos `readAt`/`ackAt`.
11. **Clique na notificação** — com o site fechado, clicar na notificação → abre/foca o dashboard.
12. **E-mail fallback** — cadastrar e-mail no eletricista **sem** subscription ativa (ou em janela anônima sem ativar push) → curl → `dispatched: 1` via e-mail. Com `BREVO_API_KEY` válida, o e-mail chega; sem key, delivery fica `FAILED` com `"BREVO_API_KEY não configurada"` (comportamento esperado em dev).
13. **Instalabilidade do PWA** — DevTools → *Application* → *Manifest*: sem erros, ícones listados; o ícone de instalar (⊕ na barra de endereço) aparece; ou rodar **Lighthouse → Installable**.
14. **Eventos de demanda (issue #12)** — como gestor, criar demanda para o eletricista → o eletricista recebe push **com `requireInteraction`** (a notificação fica fixa na bandeja até ser tratada) **e** e-mail simultâneo (se tiver e-mail cadastrado). Alterar horário/status/descrição, cancelar e excluir → cada mutação notifica técnico + participantes (menos o autor).
15. **Loop do gestor — "Ciente"** — como eletricista, clicar em **"Ciente"** na notificação → o gestor criador recebe `DEMAND_ACK_CONFIRMED` ("Chamado confirmado pelo técnico"). Clicar de novo → **não** re-notifica (só a primeira confirmação dispara).
16. **Loop do gestor — escalonamento** — deixar uma notificação de evento de demanda **não lida por ≥ 2h** → o criador recebe `DEMAND_UNSEEN_ESCALATION` ("Chamado ainda não visto"). Em dev, para não esperar 2h: baixar `NOTIFY_ESCALATION_HOURS` (ex.: `0.01`) ou ajustar `createdAt` da notificação no banco:
    ```bash
    psql "$DATABASE_URL" -c "UPDATE \"Notification\" SET \"createdAt\" = now() - interval '3 hours' WHERE id = '<id>';"
    ```
    Rodar o curl de novo → `escalated: 1`; repetir → `escalatedSkipped: 1` (dedupe).
17. **Recorrência do lembrete de finalização** — demanda com `fimPrevisto` vencido e ativa → curl → lembrete; rodar de novo na mesma hora → `skipped`; na hora seguinte → re-dispara (bucket novo). Concluir a demanda → nenhuma notificação nova (deliveries `PENDING` cancelados).

### 11.4 Teste real em celular Android (produção HTTPS ou túnel)

> Web Push no celular exige **HTTPS real** (produção já tem, via Coolify + Cloudflare Tunnel). Para testar antes de subir, usar um túnel (Cloudflare Tunnel / ngrok) apontando para `localhost:3000`.

1. No celular, abrir o site → menu do Chrome → **"Adicionar à tela inicial"** (instala o PWA).
2. Abrir o **PWA instalado** → login como eletricista → ativar notificações.
3. **Fechar o PWA** (swipe do app switcher) e **bloquear a tela**.
4. Do computador: criar demanda com início em ~10 min (ou disparar o curl diretamente contra a URL de produção).
5. O push deve chegar com **tela bloqueada** e o PWA fechado.
6. Validar os pontos da issue marcados "a validar": economia de bateria (push não vira app em primeiro plano), comportamento com **"Não perturbe"** ativo (push normal **não** fura DND — se precisar, isso é papel do ntfy, citado na issue como opção paralela).
7. Repetir ativação em cada aparelho dos eletricistas (subscription é **por dispositivo**).

### 11.5 Checklist de aceite (mapeado à issue #10)

| Critério da issue | Como verificar | Onde |
|---|---|---|
| Ativa uma vez e recebe push com site fechado + celular bloqueado | §11.4.1-5 | Android real |
| Lembrete ~15 min antes, sem duplicidade | §11.3.4-6 (janela + idempotência) | Local + Android |
| Lembrete de finalização não é enviado se concluída | §11.3.8 | Local |
| Registro de envio, leitura e confirmação | §11.3.10 (`NotificationDelivery.sentAt`, `readAt`, `ackAt`) | Local + banco |

### 11.6 Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| Botão "Ativar" não aparece | Navegador sem suporte (`unsupported`) | Usar Chrome/Edge recentes; conferir seção escondida por estado |
| `requestPermission` volta `denied` sem prompt | Usuário já negou antes | Só reverter em `chrome://settings/content/notifications`; o painel do sino mostra a instrução |
| Push não chega, mas subscription existe | Chave VAPID do servidor ≠ chave usada na subscription | Reativar notificações (resubscribe); conferir `VAPID_PUBLIC_KEY` do endpoint |
| Push não chega em produção | `CRON_SECRET` errado, task não configurada, ou demanda fora da janela | Logs da Scheduled Task no Coolify; rodar o curl manual contra produção; conferir `NOTIFY_UPCOMING_MINUTES` |
| Subscription "some" | Push service expirou (navegador desinstalado, limpeza do Chrome) | Envio retorna 404/410 → canal deleta sozinho; usuário reativa (estado do painel mostra isso) |
| Notificação antiga repetindo em cada teste | SW antigo em cache | DevTools → *Service Workers* → **Unregister** + reload; em produção, "Update on reload" durante testes |
| Notificação "SGDE" vazia no teste do DevTools | Esperado — o botão "Push" do DevTools não manda payload | Handler degrada para default (§7.2) |
| Ícone não aparece na notificação | Ícones não gerados/commitados | Rodar `pnpm run icons:generate` |
| Push funciona no desktop, não no celular via IP local | Web Push exige HTTPS fora de localhost | Testar via túnel ou produção (§11.4) |
| `P2002` no log do dispatcher | Duas varreduras coincidiram (normal) | Já tratado: virá como `skipped` |
| iOS não recebe | Esperado — iOS exige PWA instalado na tela inicial (fora do escopo atual; time é Android) | Fase futura: app nativo/wrapper (ver issue) |

---

## 12. Fase 2 — roadmap

Fora do escopo imediato, mas o modelo já prepara o terreno:

- **Urgência por demanda**: campo de urgência na demanda para variar a prioridade por evento — a decisão está centralizada em `resolvePriority(type)` (`lib/notifications/events.ts`); mudar **apenas** essa função.
- **Prazos configuráveis por tipo**: tabela de configuração por tipo (ex.: `NotificationEventConfig`) em vez de env vars/hardcode (`NOTIFY_ESCALATION_HOURS`, `NOTIFY_FINISH_MAX_HOURS`).
- **Housekeeping**: purga de notificações antigas (ex.: > 90 dias) via mesma Scheduled Task.

## 13. Considerações de segurança

- **CSRF** em todas as mutações do browser (subscribe/unsubscribe/read/ack) — mesmo padrão atual (`validateCsrf`).
- **Autorização por dono**: ninguém lê/confirma notificação de outro; subscriptions só são removidas pelo dono.
- **Agendador**: autenticação por token secreto timing-safe; fail closed se não configurado.
- **VAPID**: a chave pública é, por definição, pública — mas o endpoint `GET /api/push/vapid-public-key` requer sessão para reduzir superfície.
- **Payload de push**: sem dados sensíveis no corpo (local/descrição são operacionais — mesma informação que o eletricista já vê no dashboard).
- **E-mail**: e-mails são opcionais no cadastro e usados só para notificação do sistema.
- **Hooks de eventos**: server-side, executados dentro das rotas já autenticadas (sessão + CSRF) — sem nova superfície de API; falhas são best-effort e nunca derrubam a operação principal.

## 14. Referências

- [Issue #10 — sistema de notificações para eletricistas](https://github.com/DevGrupoBagattoli/SGDE/issues/10)
- [web-push (npm)](https://www.npmjs.com/package/web-push) — VAPID + Web Push protocol
- [MDN — Push API](https://developer.mozilla.org/pt-BR/docs/Web/API/Push_API)
- [MDN — Service Worker API](https://developer.mozilla.org/pt-BR/docs/Web/API/Service_Worker_API)
- [Brevo — Send transacational email (API v3)](https://developers.brevo.com/reference/sendtransacemail)
- Docs internos: `Docs/tecnico.md` (arquitetura/convenções), `Docs/negocio.md` (regras de negócio), `Docs/plano-deploy-coolify.md` (deploy/HTTPS)
