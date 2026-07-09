# SGDE — Documentação de Relatórios

> **Status:** Proposta para validação — ainda não implementado.
> Este documento descreve a funcionalidade de relatórios que será adicionada ao SGDE. Ele deve ser revisado e aprovado antes da implementação.

---

## Objetivo

O módulo de relatórios tem como propósito oferecer **visibilidade operacional e histórica** sobre as demandas gerenciadas no SGDE. Os relatórios permitem ao gestor responder perguntas como:

- Quantas demandas foram concluídas no último mês por cada técnico?
- Quem realizou remanejamentos e por qual motivo?
- Qual equipe está mais sobrecarregada esta semana?
- Qual é o histórico de alterações de uma demanda específica?

A premissa central é **flexibilidade**: os relatórios são filtráveis, e os dados podem ser exportados para uso externo (planilhas, arquivos de auditoria etc.).

---

## Controle de Acesso

| Tipo de Relatório                 | Gestor | Eletricista |
|-----------------------------------|--------|-------------|
| Relatório de Demandas             | ✅     | ❌           |
| Relatório de Produtividade        | ✅     | ❌           |
| Relatório de Auditoria            | ✅     | ❌           |
| Relatório de Ocupação             | ✅     | ❌           |

O módulo de relatórios é exclusivo para gestores. Eletricistas são redirecionados para `/dashboard` ao tentar acessar a rota. Acesso restrito para eletricistas poderá ser considerado em versão futura.

---

## Rota e Navegação

Uma nova página será adicionada em `/dashboard/reports`.

O link de acesso aparecerá na **sidebar de navegação** (`DashboardMobileSidebar`) apenas para usuários com perfil **Gestor**. Para eletricistas, o acesso direto via URL redireciona para `/dashboard`.

```
/dashboard           → Dashboard principal (demandas)
/dashboard/users     → Gestão de usuários   (Gestor only)
/dashboard/reports   → Relatórios           (Gestor only / Eletricista com visão restrita)
```

---

## Tipos de Relatório

### 1. Relatório de Demandas

**Propósito:** Listagem completa e filtrável de todas as demandas do sistema.

**Casos de uso:**
- Ver todas as demandas concluídas de um técnico em um período.
- Exportar a lista de demandas pendentes para enviar por e-mail.
- Conferir demandas de uma equipe específica.

**Filtros disponíveis:**

| Filtro           | Tipo                  | Descrição                                                         |
|------------------|-----------------------|---------------------------------------------------------------------|
| Período          | Intervalo de datas    | Filtra por `inicioPrevisto` dentro do intervalo.                    |
| Status           | Seleção múltipla      | Pendente, Em Andamento, Concluído, Cancelado.                       |
| Técnico          | Seleção única         | Nome do técnico responsável.                                         |
| Equipe           | Seleção única         | Nome da equipe.                                                     |

**Colunas exibidas:**

| Coluna             | Campo de origem                   |
|--------------------|-----------------------------------|
| Protocolo          | `id` (truncado para leitura)      |
| Técnico            | `tecnico`                         |
| Equipe             | `equipe`                          |
| Local              | `local`                           |
| Descrição          | `descricao`                       |
| Status             | `status`                          |
| Início Previsto    | `horarioInicio`                   |
| Fim Previsto       | `horarioFim`                      |
| Duração Prevista   | `duracaoPrevista`                 |
| Solicitante        | `solicitante`                     |
| Participantes      | `participantes` (lista separada por vírgula) |

**Totais:** O relatório exibe ao final da tabela o total de registros e a contagem por status.

---

### 2. Relatório de Produtividade por Técnico

**Propósito:** Visão comparativa do volume e da taxa de conclusão de demandas por técnico em um período.

**Casos de uso:**
- Identificar técnicos com baixa taxa de conclusão.
- Comparar a carga de trabalho entre técnicos no mês.
- Verificar quantas horas de serviço cada técnico executou.

**Filtros disponíveis:**

| Filtro   | Tipo               | Descrição                                       |
|----------|--------------------|--------------------------------------------------|
| Período  | Intervalo de datas | Filtra demandas com `inicioPrevisto` no intervalo. |
| Equipe   | Seleção única      | Opcional — filtra apenas técnicos de uma equipe. |

**Dados exibidos (uma linha por técnico):**

| Coluna                  | Descrição                                                     |
|-------------------------|---------------------------------------------------------------|
| Técnico                 | Nome do técnico.                                              |
| Equipe                  | Equipe de referência.                                         |
| Total de Demandas       | Contagem total no período.                                    |
| Pendentes               | Demandas com status `Pendente`.                               |
| Em Andamento            | Demandas com status `Em Andamento`.                           |
| Concluídas              | Demandas com status `Concluído`.                              |
| Canceladas              | Demandas com status `Cancelado`.                              |
| Taxa de Conclusão       | `Concluídas / Total` em percentual.                           |
| Horas Previstas (total) | Soma da `duracaoPrevista` de todas as demandas do técnico.    |

**Ordenação padrão:** Por total de demandas (decrescente).

---

### 3. Relatório de Auditoria (Histórico de Alterações)

**Propósito:** Registro auditável de todas as alterações feitas em demandas — especialmente remanejamentos de horário e trocas de status.

**Casos de uso:**
- Rastrear quem remarcou uma demanda e o motivo informado.
- Verificar com que frequência uma demanda específica foi alterada.
- Identificar padrões de alteração por técnico ou gestor.

**Filtros disponíveis:**

| Filtro       | Tipo               | Descrição                                              |
|--------------|--------------------|--------------------------------------------------------|
| Período      | Intervalo de datas | Filtra por `createdAt` do registro de auditoria.       |
| Tipo de ação | Seleção múltipla   | Alteração de horário, alteração de status, criação.    |
| Ator         | Seleção única      | Usuário que realizou a alteração.                      |
| Técnico      | Seleção única      | Técnico responsável pela demanda alterada.             |

**Colunas exibidas:**

| Coluna           | Campo de origem              |
|------------------|------------------------------|
| Data/hora        | `createdAt`                  |
| Demanda (ID)     | `demandId` (truncado)        |
| Técnico          | Técnico responsável da demanda |
| Ator             | `actor.name` + `actor.role`  |
| Ação             | `action` (label legível)     |
| Campo alterado   | `field` (label legível)      |
| Valor anterior   | `previousValue`              |
| Novo valor       | `nextValue`                  |
| Justificativa    | `reason`                     |

**Ordenação padrão:** Por data/hora (mais recente primeiro).

---

### 4. Relatório de Ocupação

**Propósito:** Mapa de carga de trabalho — mostra em quais dias cada técnico tem demandas agendadas, e quantas.

**Casos de uso:**
- Planejar a distribuição de novas demandas sem gerar conflitos.
- Identificar técnicos sobrecarregados em um período.
- Ver dias com mais ou menos atividade.

**Filtros disponíveis:**

| Filtro    | Tipo               | Descrição                                   |
|-----------|--------------------|----------------------------------------------|
| Período   | Intervalo de datas | Semana ou mês selecionado.                   |
| Técnico   | Seleção múltipla   | Opcional — filtra para técnicos específicos. |
| Equipe    | Seleção única      | Opcional — filtra por equipe.                |

**Visualização:**

Uma tabela onde:
- As **linhas** são os técnicos.
- As **colunas** são os dias do período selecionado.
- Cada **célula** exibe o número de demandas agendadas para aquele técnico naquele dia.
- Células vazias indicam dia livre.
- Células com alta contagem são destacadas visualmente (gradiente de cor).

**Alternativa para período longo (> 14 dias):** A visualização por dia é substituída por uma visualização por semana (sete colunas representando semanas).

---

## Exportação

Todos os relatórios que produzem tabelas (Demandas, Produtividade, Auditoria) poderão ser exportados.

| Formato | Descrição                                                            |
|---------|----------------------------------------------------------------------|
| **CSV** | Arquivo separado por vírgulas. Compatível com Excel e Google Sheets. |
| **PDF** | Documento formatado com cabeçalho do relatório, filtros ativos, tabela de dados e totais. |

A exportação deve respeitar os filtros ativos no momento do clique — ou seja, exporta exatamente o que está visível na tela.

O relatório de Ocupação não é exportável em PDF por sua natureza visual; apenas CSV.

---

## Estrutura de Interface

### Layout da Página

```
┌─────────────────────────────────────────────────────┐
│  DashboardHero (cabeçalho fixo — igual ao dashboard) │
├───────────────┬─────────────────────────────────────┤
│               │  Título do relatório + descrição     │
│  Navegação    │─────────────────────────────────────│
│  lateral      │  Painel de filtros (colapsável)      │
│  (tabs de     │─────────────────────────────────────│
│  relatórios)  │  Botões de exportação (CSV / PDF)    │
│               │─────────────────────────────────────│
│               │  Tabela de resultados                │
│               │  (sem paginação — todos os dados)    │
└───────────────┴─────────────────────────────────────┘
```

**Mobile:** A navegação lateral se transforma em um seletor horizontal (tabs com scroll), e o painel de filtros fica por baixo colapsável.

### Componentes Necessários (novos)

Seguindo a hierarquia existente `atoms → molecules → organisms → templates`:

| Componente                          | Nível     | Descrição                                                  |
|-------------------------------------|-----------|------------------------------------------------------------|
| `report-table.tsx`                  | organism  | Tabela genérica com suporte a ordenação por coluna.        |
| `report-filter-panel.tsx`           | organism  | Painel de filtros com campos dinâmicos por tipo de relatório. |
| `report-export-bar.tsx`             | molecule  | Barra com botões de exportação CSV/PDF.                    |
| `occupation-grid.tsx`               | organism  | Grade visual de ocupação (técnico × dia).                  |
| `reports-dashboard.tsx`             | template  | Orquestrador da página de relatórios.                      |

---

## APIs Necessárias (novos endpoints)

### `GET /api/reports/demands`

Retorna a lista de demandas para o relatório, com filtros de período, status, técnico e equipe. Suporta o parâmetro `export=csv` para retornar o arquivo diretamente.

**Query params:**
```
inicio       string (ISO 8601)
fim          string (ISO 8601)
status       "Pendente" | "Em Andamento" | "Concluído" | "Cancelado"  (múltiplos)
tecnico      string
equipe       string
export       "csv"  (opcional)
```

---

### `GET /api/reports/productivity`

Retorna uma linha por técnico com as métricas de produtividade no período.

**Query params:**
```
inicio   string (ISO 8601)
fim      string (ISO 8601)
equipe   string  (opcional)
export   "csv"   (opcional)
```

---

### `GET /api/reports/audit`

Retorna o log de auditoria com filtros. Sem paginação — todos os registros do período são retornados.

**Query params:**
```
inicio   string (ISO 8601)
fim      string (ISO 8601)
acao     "schedule" | "status" | "create"  (múltiplos, opcional)
ator     string  (opcional)
tecnico  string  (opcional)
export   "csv"   (opcional)
```

---

### `GET /api/reports/occupation`

Retorna a grade de ocupação: para cada técnico, quantas demandas por dia no período.

**Query params:**
```
inicio   string (ISO 8601)
fim      string (ISO 8601)
tecnico  string  (múltiplos, opcional)
equipe   string  (opcional)
```

**Resposta:**
```json
{
  "technicians": [
    {
      "name": "João Silva",
      "equipe": "Alpha",
      "days": {
        "2026-05-01": 2,
        "2026-05-02": 0,
        "2026-05-03": 1
      }
    }
  ],
  "dateRange": ["2026-05-01", "2026-05-02", "2026-05-03"]
}
```

---

## Permissões de Acesso (resumo técnico)

- Todos os endpoints de relatório chamam `requireAuth()`.
- **Todos** os endpoints de relatório retornam `403 FORBIDDEN` se o usuário for eletricista.
- O módulo de relatórios é exclusivo para gestores neste estágio. Acesso restrito para eletricistas poderá ser considerado em uma versão futura.

---

## Decisões de Produto

Itens definidos e validados com o cliente:

1. **Paginação:** Os relatórios não terão paginação. Todos os dados do período filtrado são retornados de uma vez.

2. **Exportação de PDF:** Será implementada no lado do cliente pelo dev frontend. O backend não precisa gerar PDF.

3. **Relatório de Ocupação — visualização:** A grade (técnico × dia) é suficiente para o escopo atual. Decisão de UI (ex.: gráficos adicionais) fica a cargo do dev frontend.

4. **Acesso do Eletricista:** O módulo de relatórios é exclusivo para gestores neste estágio. Eletricistas que tentarem acessar `/dashboard/reports` são redirecionados para `/dashboard`. Acesso restrito às próprias demandas poderá ser adicionado em versão futura.

5. **Presets de período:** O seletor de datas deve oferecer atalhos pré-definidos como sugestão de UX. Implementação e escolha final ficam a cargo do dev frontend.
   - Sugestões: Últimos 30 dias · Mês passado · Últimos 3 meses · Últimos 6 meses · Último ano · Ano passado.

6. **Relatórios agendados / notificações por e-mail:** Fora do escopo. Sem previsão de implementação.
