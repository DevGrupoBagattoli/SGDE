# SGDE — Documentação de Negócio

## O que é o SGDE?

O **Sistema de Gestão de Demandas Elétricas (SGDE)** é uma plataforma web voltada para empresas de serviços elétricos. Seu objetivo central é centralizar o agendamento, monitoramento e execução de chamados elétricos, eliminando conflitos de agenda e garantindo rastreabilidade completa de cada atendimento.

O sistema resolve dois problemas principais:
1. **Visibilidade da operação para o gestor** — saber quem está fazendo o quê, onde e quando, sem depender de ligações ou planilhas manuais.
2. **Autonomia controlada para o eletricista** — o técnico pode ajustar o seu próprio horário sem precisar acionar o gestor, mas com obrigatoriedade de justificativa registrada no sistema.

---

## Perfis de Usuário

O sistema possui dois perfis com permissões distintas.

### Gestor

Responsável pelo controle operacional. Tem visão completa de todos os eletricistas e demandas.

**O gestor pode:**
- Criar novos chamados (demandas) para qualquer eletricista.
- Visualizar o calendário completo de toda a equipe.
- Filtrar a visão por eletricista específico.
- Editar o horário de qualquer demanda.
- Alterar o status de qualquer demanda.

### Eletricista

Perfil de campo. Acessa o sistema para gerenciar seus próprios atendimentos.

**O eletricista pode:**
- Visualizar apenas as suas próprias demandas.
- Criar novos chamados (atribuídos automaticamente a si mesmo).
- Editar o horário de seus atendimentos (com justificativa obrigatória quando há alteração de data/hora).
- Alterar o status de seus atendimentos.
- O filtro de técnico fica bloqueado — ele não vê demandas de outros eletricistas.

---

## Ciclo de Vida de uma Demanda

Cada chamado passa por três estágios de status:

```
Pendente  →  Em Andamento  →  Concluído
```

| Status | Significado |
|---|---|
| **Pendente** | Chamado criado, aguardando início da execução. |
| **Em Andamento** | Técnico já está no local ou iniciou o serviço. |
| **Concluído** | Serviço finalizado e verificado. |

O status pode ser alterado tanto pelo gestor quanto pelo eletricista, a qualquer momento. Não há restrição de ordem — é possível, por exemplo, mover uma demanda de "Concluído" de volta para "Em Andamento" se necessário.

---

## Campos de uma Demanda

| Campo | Obrigatório | Descrição |
|---|---|---|
| **Eletricista** | Sim | Técnico responsável pelo atendimento. |
| **Equipe** | Não | Nome da equipe à qual o técnico pertence (ex: Alpha, Beta). |
| **Local** | Sim | Endereço, bloco, cliente ou unidade onde o serviço será realizado. |
| **Descrição** | Sim | Detalhamento do que deve ser executado no atendimento. |
| **Dia e Horário** | Sim | Data e hora de início prevista para o atendimento. |
| **Duração Prevista** | Sim | Estimativa de tempo de execução (ex: `02:00h`). |
| **Status** | Sim | Situação atual do chamado. |
| **Observações** | Não | Campo livre para anotações. Obrigatório quando há alteração de horário. |

---

## Regra de Remanejamento

Esta é uma das regras de negócio mais importantes do sistema:

> **Toda alteração de data ou horário de uma demanda exige o preenchimento obrigatório do campo de Observações, descrevendo o motivo da mudança.**

Se o usuário tentar salvar uma alteração de horário sem preencher a justificativa, o sistema bloqueia o salvamento e exibe uma mensagem de erro.

Isso garante um **histórico auditável** de todas as mudanças de agenda, visível tanto pelo eletricista quanto pelo gestor.

---

## Fluxos de Usuário

### Fluxo do Gestor

```
1. Acessa a tela de login
2. Seleciona o perfil "Gestor", informa nome e senha
3. Entra no Dashboard principal com visão de todos os eletricistas
4. Visualiza os cartões de métricas (total de demandas por status)
5. Navega pelo calendário central para ver distribuição de atendimentos por dia
6. Filtra o calendário por eletricista específico (opcional)
7. Clica em um dia do calendário para ver os horários daquele dia no painel lateral
8. Navega pela lista de detalhes dos atendimentos na parte inferior
9. Cria um novo chamado clicando em "Novo chamado" no cabeçalho
   → Preenche todos os campos obrigatórios e confirma
10. Edita o horário de uma demanda clicando em "Editar horário" em qualquer card
    → Altera a data/hora; se diferente do original, deve preencher justificativa
11. Altera o status de uma demanda diretamente pelo dropdown no card
12. Sai do sistema clicando em "Sair"
```

### Fluxo do Eletricista

```
1. Acessa a tela de login
2. Seleciona o perfil "Eletricista", escolhe seu nome na lista e informa o PIN
3. Entra no Dashboard filtrado com apenas suas próprias demandas
4. O calendário já abre no mês da sua primeira demanda agendada
5. Visualiza apenas seus atendimentos no calendário e na lista
6. Clica em um dia para ver os horários daquele dia no painel
7. Pode criar novos chamados (já atribuídos a si mesmo automaticamente)
8. Edita horários com justificativa obrigatória quando há alteração
9. Atualiza o status de seus atendimentos conforme execução
10. Sai do sistema clicando em "Sair"
```

---

## Telas do Sistema

### Tela de Login

Ponto de entrada do sistema. Apresenta dois cartões lado a lado:
- **Cartão Gestor:** campos de nome e senha.
- **Cartão Eletricista:** seleção de técnico por lista e PIN numérico.

A escolha do perfil determina toda a experiência subsequente no sistema.

### Dashboard Principal

Tela central do sistema após o login. Composta por:

| Seção | Descrição |
|---|---|
| **Cabeçalho (Header)** | Logo do sistema, nome e perfil do usuário logado, contador de demandas, botões de "Novo chamado" e "Sair". |
| **Cartões de Métricas** | Exibem o total geral de demandas e a contagem por cada status (Pendente, Em Andamento, Concluído). |
| **Calendário Central** | Visão mensal com as demandas distribuídas por dia. Permite navegar entre meses, filtrar por eletricista e selecionar um dia. |
| **Painel de Horários do Dia** | Ao selecionar um dia no calendário, exibe os atendimentos daquele dia em formato de lista com horário de início, duração e status. |
| **Lista de Detalhes** | Lista completa de todos os atendimentos visíveis, com opção de editar horário e alterar status diretamente. |

### Modal "Criar Chamado"

Formulário completo para criação de uma nova demanda. Para eletricistas, o campo de técnico fica bloqueado e pré-selecionado com o próprio nome.

### Modal "Editar Agenda"

Formulário focado para alterar o horário de uma demanda existente. Exibe o técnico e o local como contexto. Exige justificativa no campo de observações caso o horário seja alterado.

---

## Restrições e Permissões por Perfil

| Ação | Gestor | Eletricista |
|---|---|---|
| Ver demandas de todos os técnicos | ✅ | ❌ |
| Filtrar por técnico | ✅ | ❌ (bloqueado no próprio) |
| Criar demanda para qualquer técnico | ✅ | ❌ (apenas para si) |
| Editar horário de qualquer demanda | ✅ | ✅ (apenas as suas) |
| Alterar status de qualquer demanda | ✅ | ✅ (apenas as suas) |

> **Nota:** As restrições de visibilidade são aplicadas apenas no front-end neste estágio do projeto. A implementação completa das permissões deve ser enforçada pela API backend.
