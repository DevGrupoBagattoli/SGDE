# Sistema de Gestão de Demandas Elétricas (SGDE)
 
**Objetivo:** Centralizar o agendamento, monitoramento e execução de serviços elétricos, permitindo que gestores controlem a carga de trabalho e eletricistas tenham autonomia para ajustar horários com a devida justificativa.
 
## 1. Módulos e Funcionalidades
 
### A. Gestão de Equipes e Cadastro
 
**Cadastro de Eletricistas:** Registro individual ou por grupos (equipes).
 
**Identificação por Tags:** Cada demanda deve ser "taggeada" com o nome do eletricista ou do grupo responsável.
 
**Gestão de Disponibilidade:** Visualização em tempo real de quem está livre ou em serviço.
 
### B. Painel do Gestor (Controle de Operações)
 
**Criação de Demandas:** Abertura de chamados é de responsabilidade exclusiva dos gestores, incluindo a inserção de local, descrição detalhada do serviço e tempo previsto.
 
**Atribuição de Responsáveis:** O gestor designa o eletricista ou equipe responsável pela demanda.
 
**Visão de Calendário Total:** Interface de auditoria que permite visualizar a agenda de todos os colaboradores simultaneamente para evitar demandas concorrentes (conflitos de horário). A interface do calendário deve ser simples, clara e direta.

**Suporte a Demandas Multi-dia:** O sistema deve permitir demandas que iniciam em um dia e terminam em outro, inclusive durações superiores a 24 horas.
 
### C. Interface do Eletricista (Campo)
 
**Status da Demanda:** Marcação clara entre "Pendente", "Em Andamento" ou "Concluído".
 
**Remanejamento com Justificativa:** O remanejamento de horários e datas das demandas é realizado pelo próprio eletricista, sendo obrigatório o preenchimento de um campo de "Observações" para registrar o motivo da alteração e validá-la perante o gestor.
 
**Inclusão de Colaboradores:** O eletricista pode adicionar outros membros à demanda quando identificar necessidade de apoio. Exemplo: Fernando é atribuído a uma tarefa, mas percebe que precisa da ajuda do Rudney — ele mesmo pode incluí-lo.
 
**Lista de Tarefas:** Visualização organizada por ordem de prioridade.
 
## 2. Estrutura de Dados (Campos Essenciais)
 
Para que o sistema funcione com a lógica descrita, cada Evento/Chamado deve conter:
 
| Campo | Descrição |
|---|---|
| ID / Protocolo | Identificador único para rastreio e auditoria |
| Responsável | Nome do eletricista ou equipe (Tag) |
| Solicitante | Gestor que abriu o chamado |
| Colaboradores | Membros adicionados pelo eletricista durante a execução |
| Localização | Endereço ou setor do serviço |
| Descrição | Detalhamento do que deve ser executado |
| Início Previsto | Data e hora planejadas para início da demanda |
| Fim Previsto | Data e hora planejadas para término da demanda |
| Tempo Previsto | Duração estimada (ex: 02:00h) |
| Status | Situação atual da demanda (Pendente / Em Andamento / Concluído) |
| Histórico de Alterações | Log que registra quem alterou o horário original, quando e o motivo inserido |