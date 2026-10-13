# Calendário oficial de formação — outubro de 2026

Fonte indicada pela escola: [Formação Continuada — Ensino Fundamental](https://sites.google.com/sme.pmf.sc.gov.br/portaleducacional/forma%C3%A7%C3%A3o-continuada-ensino-fundamental).
Documento: [OUTUBRO_Calendário de Formação_DEF_2026](https://docs.google.com/presentation/d/e/2PACX-1vSfesD6aPQbTgK-tBDcBEu5bFId-0RWJQ4YZ37WbgjBdd53Nrq6p2u-tNpdFAO1ZA/pub), apresentação pública de 25 páginas.
Consulta em 13/10/2026, exclusivamente na nuvem.

## Conteúdo disponibilizado

- 100 faixas de horário, correspondentes aos grupos e períodos com data publicada, em 19 áreas.
- Quatro atividades on-line sem data e horário definidos: Matemática, grupos 1, 3 e 4; Estudos Matemáticos, grupo 1.
- CSV em UTF-8 com BOM e separador ponto e vírgula: 104 registros, incluindo os quatro pendentes. É uma cópia dos dados para consulta no Excel, não o arquivo original da apresentação.
- Formação e calendário interno apresentam os mesmos registros oficiais. O PDF/PPTX original continua referenciado pelo link da SME. A exportação da apresentação pelo Google passou a exigir autenticação; nenhuma cópia PDF foi anunciada como baixada.
- Campos vazios do calendário original permanecem vazios. Os horários de manhã e tarde em encontros integrais são apresentados separadamente, preservando os intervalos.

Os registros oficiais são somente para consulta. A equipe continua criando e editando os encontros próprios da escola. A fonte oficial é uma fotografia da publicação consultada, sem sincronização automática. Novas retificações precisam ser conferidas na página da SME.

## Divergências identificadas

A apresentação indica Artes até 17h, enquanto o portal resume até 16h. Em Educação Física, a apresentação indica 09h–11h pela manhã, enquanto a página da área informa 09h–12h. Os registros preservam a apresentação e exibem a divergência para confirmação com a SME.

Orientadores e supervisores têm uma célula de ciclo rotulada como presencial, mas a coluna de local indica on-line. A modalidade apresentada segue a coluna de local, com uma nota sobre a inconsistência. Não foram consultadas listas nominais de inscritos nem assumido o grupo de qualquer servidor.

## Implementação e proteção

`src/official-trainings.mjs` guarda a referência e os horários extraídos das tabelas. `tests/fixtures/sme-outubro-2026.json` preserva as linhas da fonte para conferir cobertura, datas e períodos.

`GET /api/official-trainings` exige uma conta ativa de funcionário. O download fica em `/equipe/calendarios/formacao-outubro-2026.csv`, protegido pela identidade e pelo cadastro nominal. O nome físico do asset não permite download anônimo. Esses dados não entram em `/public/api`.

A interface combina a referência da SME com os encontros próprios, sem copiar registros para o banco ou alterar os registros existentes. Não há migração D1 nesta revisão. A atualização da tela não duplica as entradas oficiais.

## Evidência de obtenção

As tabelas completas foram lidas com resposta HTTP 200 no [runner de consulta](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/38349737203), antes de o Google passar a exigir login para novas solicitações. A consulta também verificou o portal atual, evitando usar locais antigos do índice de busca. As tentativas de exportação que geraram documento vazio ou foram recusadas foram descartadas e não fazem parte da entrega.
