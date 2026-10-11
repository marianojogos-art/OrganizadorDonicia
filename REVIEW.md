# Revisão da fonte e decisões

## Fonte preservada

ZIP fonte SHA-256: b42a382d5ed8b8993af47ff28c256b56fa6ad6d8fb0e0c2d733ad098b7484f89. O original foi extraído em pasta separada e não alterado. O primeiro commit deste repositório preserva os sete arquivos recuperados. `MANIFEST.json` registra a exportação original; não descreve os arquivos adicionados ao candidato.

## Arquitetura encontrada

Uma página HTML com CSS e JavaScript inline; oito módulos; listas fictícias em memória; sem contas, servidor, API ou banco. Scripts package apontavam para build/dev/testes inexistentes, e Drizzle apontava para schema ausente. O desenho validava reservas e alguns estados no navegador, sem proteção servidor. Recarregar perdia as alterações.

## Priorização e implementação

1. Persistência e autorização: Worker + D1/SQLite, nominalidade, JWT verificado e fechamento seguro
2. Reservas/tarefas: fluxo completo com regras no servidor e persistência
3. Substituições/xerox/atas/calendário: regras próprias, autorização de direção e testes
4. Usabilidade: visual escolar limpo, ações claras, formulários curtos, datas locais, teclado, estados vazios/carregamento/erro, feedback de gravação e prevenção de duplicidade de submit
5. Dados de estudantes: bloquear enquanto o tratamento e as responsabilidades não estiverem aprovados

## Assunções que a escola deve confirmar

- Professores criam suas reservas, tarefas próprias e pedidos de xerox; a direção gerencia delegação, restrição, substituições, auxiliares, atas, calendário e aprovação de xerox
- Tarefas restritas são visíveis à direção, ao responsável e ao criador; não possuem lista customizada de participantes
- Atas e calendário são visíveis à equipe autorizada; não inserir conteúdo pessoal sensível
- Cada registro de substituição representa uma aula. Limite de 32 vem do protótipo e não é uma norma validada; semana começa segunda-feira, horário local America/Sao_Paulo
- Nenhum tratamento oficial de frequência e nenhuma importação automática

## Situação atual e próximas etapas

Esta revisão arquitetural começou com a fonte original. A situação de publicação atual é registrada no [README](README.md). Após os PRs1–8, autenticação Access, D1 remoto, seleção de semana das auxiliares, Supervisão compartilhada, leiaute para smartphone e agenda mensal estão implementados e publicados. O PR8 é a base de código desta revisão documental; 94 testes da raiz passaram.

Pendências que permanecem:

- Política de retenção da auditoria, ensaio de recuperação D1/backup, paginação e limites operacionais para maior volume.
- Perfil de supervisão específico, autorização granular e observabilidade sem dados pessoais.
- Proposta de estudantes somente sintética; sem ativação de tratamento de dados pessoais.
- Geração Drizzle e validação física completa do aplicativo nativo. O leiaute do site foi verificado por emulação no Chromium em quatro larguras, além dos fluxos conferidos em produção; isso não comprova instalação/uso do APK ou comportamento no Safari de um iPhone físico.
- Novos usuários continuam exigindo provisionamento nominal e política Access; Google institucional não foi habilitado como provedor adicional nesta revisão.

## Revisão independente

Correções incorporadas: escape de nome de auxiliar e responsável em HTML; data escolar em São Paulo; falha DB sanitizada 503; compare-and-swap nas etapas de xerox; formulário de ajuste/reenviar; orientação com auxiliar vazio; rotas de item estritas sem bypass de versão; formulários protegidos durante gravações; distinção entre salvar e atualizar a lista; retirada/desativação segura de auxiliares; integridade também para inserção/alteração de horários no banco. Testes de regressão correspondentes acrescentados.

## Fontes técnicas consultadas em 03/10/2026

- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/d1/sql-api/sql-statements/

As habilidades Workers fornecidas foram lidas e aplicadas como orientação de preservação de contratos, configuração e evidências. Nenhum identificador ou wrapper operacional da Lepidus foi transplantado.
