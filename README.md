# Organizador Donícia — Cloudflare Workers

Projeto escolar independente para a EBM Donícia Maria da Costa, publicado em [Organizador Donícia](https://organizadordonicia.carijo.workers.dev/) com a área de funcionários protegida por Cloudflare Access. O GitHub está conectado ao Worker `organizadordonicia`, com build e publicação automáticos da branch `main`. Não utiliza recursos operacionais da Lepidus.

## Portal público e perfis — implementação de 13/10/2026

Esta revisão implementa o portal público e a separação de acessos, preservando as melhorias existentes de reservas, xerox com anexos, formação integrada ao calendário e notas pessoais. A autorização vigente de 11/10/2026 cobre integração e publicação contínua no Worker existente após validação; o resultado efetivo deve ser comprovado pelo commit, pela CI e pelo deployment. Os totais de testes de bases anteriores não comprovam esta integração.

| Acesso | Conteúdo e ações |
| --- | --- |
| Público, sem login, em `/` | Apresentação da escola, avisos publicados, calendário público e contatos. O link discreto **Acesso de funcionários** abre `/equipe`. |
| Professor, após login institucional | Pedidos de xerox, pedidos de reserva de espaço, calendário público e interno, calendário de formação por área. |
| Direção, supervisão e orientação, após login institucional | Acesso completo à gestão, incluindo aprovação de reservas e manutenção dos conteúdos públicos, calendário e formações. |

As permissões são verificadas na API: professores não podem consultar tarefas, atas, substituições, Supervisão, auditoria ou cadastros administrativos. Login válido também exige uma conta nominal ativa em `users`; não existe cadastro aberto. Os papéis técnicos são `direction`, `supervision`, `guidance` e `teacher`, com as mesmas permissões completas para os três primeiros neste momento.

A equipe publica avisos e edita apresentação e contatos em **Comunicação pública**. Avisos novos ficam como rascunho até a opção de publicação ser marcada. No **Calendário**, a equipe escolhe **Interno** ou **Público** por evento; eventos anteriores permanecem internos. `/public/api` expõe somente informações da escola, avisos publicados e eventos públicos, sem atas, contas, reservas, pedidos de xerox ou detalhes internos das formações.

Em **Formação**, a equipe cadastra título, área, data, horários opcionais, local e observações. Professores consultam o calendário e filtram por área e mês. Os encontros existentes são preservados. O anexo mencionado para o novo calendário oficial não foi disponibilizado nesta conversa, portanto nenhuma data oficial foi inventada ou importada.

A migração `0010_public_portal.sql` sucede as migrações 0006–0009 e adiciona os novos perfis, conteúdos públicos e a área das formações. Ela preserva os vínculos de usuários, marca reservas anteriores como **Aprovada** e eventos anteriores como **Interno**. O executor local aplica cada migração em uma transação, como o D1, inclusive a atualização da tabela de usuários.

Formação continua usando os mesmos eventos do calendário, sem duplicar registros; `/api/trainings` apresenta os encontros por área. As notas pessoais ficam disponíveis à equipe pedagógica e preservam o isolamento por proprietário, inclusive entre direção, supervisão e orientação.

A configuração Access salva usa a mesma aplicação e audience, com proteção integral das prévias do Worker e quatro destinos privados no domínio de produção: `/equipe`, `/ap*`, `/index.html` e `/sge-connector.zip`. O endpoint anônimo canônico é `/public/api`; o alias `/api/public` permanece protegido na borda. Veja o [registro e procedimento de deploy](docs/deploy.md#portal-público-e-acesso-de-funcionários).

A versão integrada [`90e4bec`](https://github.com/marianojogos-art/OrganizadorDonicia/commit/90e4bec189b7ccf1879ccd601491e13f6383b4e4) passou pela validação e exportação móvel da CI e foi publicada com sucesso na Cloudflare, versão `919cf186-31b7-4e37-bb49-ab449edfb31e`. A verificação HTTP anônima pela nuvem ainda precisa de resultado registrado; os logins reais dos quatro perfis não foram testados. A publicação preserva os registros anteriores e não completa o calendário oficial de formação sem o anexo.

## Componentes e estado de referência — 11/10/2026

A auditoria partiu da `main` [`32b11d8`](https://github.com/marianojogos-art/OrganizadorDonicia/commit/32b11d8), que integrou o PR11. A organização ([PR12](https://github.com/marianojogos-art/OrganizadorDonicia/pull/12)) e a conciliação Android ([PR13](https://github.com/marianojogos-art/OrganizadorDonicia/pull/13)) foram integradas depois, preservando os históricos. Os números abaixo identificam componentes diferentes; não são uma release conjunta.

| Componente | Versão no código integrado | Distribuição e limites |
| --- | --- | --- |
| Web / API Workers | `package.json`: `2.0.0` | O commit e o deployment identificam cada publicação; o número do pacote não muda a cada PR. |
| Extensão Chrome/Edge | `sge-connector/manifest.json`: `1.3.1` | O build gera o ZIP e a pasta descompactada. Reinstalar/recarregar a extensão para atualizar a versão instalada. |
| Aplicativo Expo | `mobile-sge/package.json` e `app.json`: `1.0.1`, Android `versionCode` 2 | Código conciliado pelo PR13; exportação aprovada. Nenhum novo APK assinado/instalado foi produzido nesta tarefa. |
| Banco | `migrations/`: cinco migrações na base | Produção `donicia-school`; prévia isolada `donicia-school-preview`. |

O PR11 registra publicação Cloudflare `d777092a-f6b0-4564-bac5-8b940b03d10d`, em 11/10/2026 às 04:42:58 UTC. Esse registro histórico não comprova o status atual do Worker, a atualização de uma extensão instalada ou uma nova consulta autenticada. A `main` contém conector `1.3.0`, consulta por trimestre, nomes de turmas padronizados e espera pelo carregamento real do SGE. A referência anterior `1.2.3` pertence ao PR6. O [changelog](CHANGELOG.md) registra a sequência sem inventar tags ou releases.

A branch `app-android-1-0-1` deve ser preservada. Sua compatibilidade com a web atual foi conciliada nesta branch por merges e regeneração dos runtimes; isso não equivale a compilar, assinar, instalar ou testar um APK `1.0.1`.

## Começar e encontrar a documentação

Requer Node.js 24, npm e dependências fixadas nos dois lockfiles:

```sh
npm ci
npm --prefix mobile-sge ci
npm run validate
npm run dev
```

O servidor de demonstração abre `http://127.0.0.1:8787`, usa identidade fictícia e SQLite local em `.local/`. Não inserir dados reais. Para conferir os perfis locais, a variável de processo `LOCAL_ROLE` admite `direction` (padrão), `supervision`, `guidance`, `teacher` ou `anonymous`; essa opção nunca é lida de requisições ou cookies. O Worker de produção verifica identidade e permissões; a identidade de demonstração existe somente em `scripts/dev.mjs`. O build gera portal e área de funcionários separados, servidos em `/` e `/equipe`, com scripts `/public.js` e `/equipe/app.js`.

- [Desenvolvimento e validação](docs/desenvolvimento.md): mapa de pastas, scripts, testes, arquivos gerados e limitações.
- [Governança e limpeza segura](docs/governanca.md): inventário de branches e proteção proposta, pendentes de aprovação.
- [Verificação desta revisão](docs/verificacao.md): resultados, SHAs e limites de execução.
- [Preparação Chrome Web Store](docs/chrome-web-store/README.md): pacote, imagens, privacidade e requisitos para submissão.
- [Habilidade de sincronização](.agents/skills/sincronizar-projetos-github/SKILL.md): cópia exportável do fluxo cloud/GitHub/Cloudflare de Mariano.
- [Contribuição](CONTRIBUTING.md): revisão, commits, PRs e cuidado com dados/credenciais.
- [Deploy e plano de versões](docs/deploy.md): prévia, autorização, migrações, publicação e validação posterior.
- [Extensão SGE](sge-connector/README.md) e [aplicativo móvel](mobile-sge/README.md): instalação, diferenças e verificação manual.
- [Orientações do projeto](AGENTS.md) e [revisão inicial](REVIEW.md): regras e contexto histórico.

A CI valida raiz e aplicativo móvel sem publicar produção. Testes automatizados não substituem login institucional, SGE autenticado, aparelho físico nem ensaio de recuperação D1. Evidências históricas do PR8 incluem 94 testes da raiz, build e emulação de viewport; use a execução do commit revisado para conhecer os resultados atuais.

## O que funciona

- Supervisão: consulta de turmas pelo conector, resultados compartilhados salvos no D1, seleção por professor, filtros por Situação, trimestres, relatório de ocorrências e reinício da tela sem excluir os dados salvos. Veja [sge-connector/README.md](sge-connector/README.md).
- Reservas: agenda semanal e mensal por espaço, com navegação entre períodos, reservas e ocupações fixas no mesmo dia, e reserva direta da data escolhida; responsável nominal obrigatório, preenchido inicialmente com o usuário atual; professores enviam pedidos pendentes e a equipe aprova ou recusa; edição/cancelamento pelo criador ou equipe, com restrições após aprovação; impedir sobreposição entre reservas aprovadas e ocupações fixas no banco de forma atômica; ocupação semanal fixa com período inclusivo de validade, administrada pela equipe pedagógica; turma e disciplina opcionais
- Tarefas: exclusivas da equipe pedagógica, que cria/edita/remove, define prazo, responsável nominal, estados e restrição
- Substituições: professores e aulas do WebHorário, busca por nome, dia atual e quantidade de dias corridos; prévia por turma/horário, auxiliar padrão para todas as aulas e divisão por aula; troca direta no quadro semanal, confirmação de realização e relatório com limite semanal; conflitos de turma e auxiliar bloqueados; desativação preserva aulas realizadas e libera as futuras ainda agendadas
- Xerox: professor, turma opcional, impressão preto e branco/colorida, material, quantidade e prazo; anexo PDF/PNG/JPEG até 256 KiB com download privado pelo proprietário/equipe pedagógica; aprovação e transições concorrentes preservadas
- Atas: exclusivas da equipe pedagógica, que registra/edita/remove e consulta
- Calendário e Formação: mesmos registros, filtros por mês/tipo/área, horários, local e informações; a equipe mantém os eventos e define visibilidade pública/interna; professores consultam ambos os calendários e visitantes somente eventos públicos
- Minhas notas: cartões pessoais da equipe pedagógica, com isolamento na API inclusive contra acesso de outros integrantes da equipe e direção; professores não acessam este módulo
- Estudantes: desabilitado, sem tabela ativa nem rota. Proposta sintética em `db/proposals/`, fora das migrações, para revisão futura

Detalhes, limites e evidências das quatro melhorias: [guia de outubro](docs/melhorias-2026-10.md).

Durante uma gravação, o formulário permanece protegido contra fechamento ou troca acidental. Se o banco salva e a atualização da lista falha, a interface informa que a alteração foi salva e oferece atualizar, evitando repetir a gravação.

Edições e remoções usam a versão do registro para detectar mudanças concorrentes. Auditoria registra ator, método, rota e horário na mesma transação, sem copiar conteúdo pessoal. Somente a equipe pedagógica consulta os últimos 100 eventos.

## Acesso

A aplicação usa Cloudflare Access como fronteira de identidade humana da área de funcionários. O login inicial usa código enviado ao e-mail institucional (One-time PIN), com política nominal para a conta de direção autorizada. Na configuração registrada em 13/10/2026, o Access protege as prévias do Worker e os caminhos privados do domínio de produção, conforme [deploy](docs/deploy.md#portal-público-e-acesso-de-funcionários), preservando a autenticação da área privada. O Worker verifica a assinatura RSA do JWT, emissor, audience, validade e domínio `@prof.pmf.sc.gov.br`. Isso não autoriza todo o domínio: o e-mail deve existir e estar ativo na tabela `users`.

O JWT é lido do cabeçalho `Cf-Access-Jwt-Assertion` ou, quando o cabeçalho não está presente, do cookie de aplicação `CF_Authorization`. Ambos passam pela mesma verificação criptográfica. Isso permite autenticar quando o roteador de Static Assets não encaminha o contexto de identidade ao Worker. Cookies duplicados são recusados e um cabeçalho inválido não usa o cookie como alternativa.

A consulta às chaves públicas usa `redirect: 'manual'` e recusa respostas sem sucesso, incluindo redirecionamentos. O runtime Workers não aceita `redirect: 'error'`; essa opção interrompia a validação antes de consultar as chaves, mesmo depois de um login Access válido. O teste no Miniflare reproduziu a falha anterior e verifica login por cabeçalho e cookie, assinatura inválida e recusa de redirecionamentos. Diagnóstico opcional com `ACCESS_DIAGNOSTICS=1` registra somente códigos fixos de falha, sem JWT, cookies ou e-mail; fica desativado por padrão.

Perfis desta revisão: `direction`, `supervision`, `guidance` e `teacher`. As permissões são verificadas na API. Direção, supervisão e orientação têm acesso completo por decisão da escola; professores têm somente os quatro recursos descritos acima. Usuários são provisionados por migração administrativa revisada; não existe cadastro aberto.

## Banco

Os arquivos em `migrations/` são a fonte executável do esquema SQLite/D1 e dos triggers. `db/schema.ts` descreve as tabelas para Drizzle. Não usar o resultado de `db:generate` como substituto dos triggers revisados. O banco configurado é `donicia-school`, ID `e8a8a803-273b-42a6-bcc6-1aefeb78ad78`, binding `DB`. A migração inicial foi aplicada remotamente em 05/10/2026 e registrada em `d1_migrations`; os 13 triggers foram criados. As condições dos triggers usam `SELECT RAISE(...) WHERE ...`, pois o parser remoto falha ao separar lotes com `CASE ... END` dentro de triggers. A migração `0002_substitution_planning.sql` adiciona confirmação de aulas realizadas, cache da lista de professores e três auxiliares de exemplo: Ana, Beatriz e Carla, identificadas como fictícias. A migração `0003_webhorario_lessons.sql` guarda a grade de aulas, o período de ausência e o vínculo de cada aula com esse período, incluindo a disciplina. As migrações locais são aplicadas uma vez, preservando bancos de demonstração existentes.

## Usar reservas de espaços

Em **Espaços**, clique em **Ver agenda** no ambiente desejado ou escolha o local no campo **Espaço** da agenda.

- **Semana**: mostra de segunda a domingo as reservas e os horários fixos válidos. Use **Anterior**, **Próxima**, **Esta semana** ou o campo **Semana de**.
- **Mês**: mostra o calendário mensal, iniciado na segunda-feira. Use **Anterior**, **Próximo**, **Este mês** ou o campo **Mês**. Cada dia informa a quantidade de reservas e horários fixos; essa quantidade não significa que o dia inteiro está ocupado.
- Selecione um dia no mês para consultar horários, atividades e responsáveis abaixo do calendário. A seleção permanece ao alternar as visões; a semana exibida acompanha o dia escolhido.
- **Reservar neste dia** abre o formulário com o espaço e a data selecionados. Informe início, término, responsável e atividade. Pedidos de professores ficam **Pendente**; reservas criadas diretamente pela equipe ficam **Aprovada**. A aprovação bloqueia horários conflitantes.

A equipe pedagógica pode **Aprovar** ou **Recusar** os pedidos. Somente reservas **Aprovada** ocupam o horário: pedidos pendentes podem coincidir, mas a aprovação é recusada se houver outra reserva aprovada ou ocupação fixa conflitante. Aprovações concorrentes para o mesmo horário resultam em uma confirmação e um conflito, sem dupla reserva. Professores podem editar seus pedidos pendentes ou recusados e reenviá-los como **Pendente**; a edição de uma reserva já aprovada cabe à equipe. Professores veem seus pedidos e as reservas aprovadas; pedidos pendentes ou recusados de outros professores ficam restritos à equipe e ao solicitante.

Os horários fixos só aparecem no dia da semana correspondente e dentro do período de validade. O calendário mensal inclui fins de semana e anos bissextos.

O campo **Responsável** é obrigatório e pode ser alterado na criação ou edição. O nome indicado aparece na agenda, nas próximas reservas e no resumo do dia. A conta que criou a reserva permanece registrada e controla as permissões de edição e cancelamento junto com a equipe pedagógica. A migração `0004_reservation_responsible.sql` preenche reservas antigas com o nome do criador e preserva os demais dados. Essa migração já faz parte do conjunto aplicado; o deploy aplica apenas migrações pendentes.

## Usar substituições

Em **Substituições → Registrar ausência**, digite o começo do nome do professor e selecione uma sugestão (clique ou setas e Enter). O primeiro dia vem preenchido com o dia atual da escola. **Adicionar dias** escolhe uma quantidade de 0 a 30 dias adicionais; o total aparece ao lado. São dias corridos: por exemplo, sexta-feira mais 3 dias inclui sexta, sábado, domingo e segunda.

O sistema consulta a grade semanal e mostra, por dia, cada turma, atividade e horário que precisa de cobertura. Dias sem aulas aparecem sem criar substituições. A primeira auxiliar cadastrada vem selecionada para todas as novas aulas; mudar a auxiliar padrão aplica a escolha a todas. Para dividir as aulas de um mesmo dia, altere o seletor na linha de cada aula. Também é possível deixar aulas pendentes para distribuir depois.

Aulas já registradas são identificadas na prévia e preservadas; somente as aulas faltantes são adicionadas. Conflitos parciais precisam ser corrigidos no quadro semanal. Todos os registros novos e o período de ausência são salvos numa transação: conflito ou limite excedido cancela o lote inteiro. O servidor obtém turmas e horários da grade, valida as alterações individuais e recusa uma prévia que ficou desatualizada antes de salvar.

A grade é lida da [página pública da escola no WebHorário](https://www.webhorario.com.br/gradeporprofs.php?id=7829), versão `2026-08-20_15-40-49`: 34 entradas e 703 aulas semanais, incluindo duas duplas, resultam em 36 nomes individuais. A leitura verifica a quantidade de aulas publicada para cada professor e usa o horário escrito em cada célula, incluindo intervalos diferentes entre turmas. A última grade válida fica no D1 por 24 horas. **Atualizar grade** força nova leitura; se a fonte estiver fora do ar ou mudar de formato, a grade anterior permanece disponível com indicação de desatualização. Essa lista não cria usuários nem concede acesso ao sistema. A prévia corresponde à grade semanal publicada; mudanças pontuais podem ser ajustadas pela direção no quadro semanal.

O seletor de semana e os botões anterior/atual/próxima mostram as aulas e a carga de cada auxiliar. O seletor de auxiliar em cada linha troca a responsável por aquela aula, com verificação de versão, limite semanal e horários sobrepostos. **Marcar realizada** confirma uma aula de hoje ou de um dia anterior. O relatório distingue realizadas e agendadas, mostra total/limite e aulas disponíveis, e permite abrir o detalhamento de cada auxiliar. O limite considera ambas as categorias. Aulas realizadas mantêm o histórico mesmo após desativar a auxiliar; para trocar ou retirar sua responsável, desmarque a realização primeiro.

A Supervisão permite baixar o relatório de ocorrências em texto e mantém consultas compartilhadas no D1 pela migração `0005_supervision.sql`. A prévia e os filtros também possuem estado local na tela. A Supervisão não envia notificações externas nem recebe anexos; pedidos de xerox possuem o fluxo privado de arquivos descrito no guia de outubro.

## Usar no smartphone

O botão **Menu** abre todas as seções. Tabelas se reorganizam por registro em telas pequenas, com rótulos de coluna, controles de toque maiores e campos de 16 px. Formulários respeitam a altura disponível e mantêm as ações acessíveis. A navegação oferece foco por teclado, fechamento do menu por Escape e preferência de movimento reduzido.

No navegador do celular, é possível usar a gestão e consultar os resultados salvos da Supervisão. Novas leituras do SGE pelo conector Chrome/Edge exigem o computador com a extensão instalada e uma sessão autenticada. O aplicativo nativo possui sua própria ponte SGE e suas validações são descritas separadamente no README móvel.

## Antes de ampliar o uso escolar

1. Confirmar conta Cloudflare autorizada, nome/projeto separado e domínio, preservando o site atual
2. Confirmar pessoas/perfis, política de tarefas restritas e responsáveis por aprovação de xerox
3. Revisar novas políticas Access ou provedores de identidade antes de alterar a configuração inicial
4. Provisionar os novos usuários nominais e validar login institucional real; a migração inicial e o cadastro de direção já foram aplicados
5. Ampliar a validação para aparelhos físicos e ensaiar recuperação do banco; a emulação desktop/mobile e os fluxos listados acima já foram verificados
6. Confirmar política escolar de 32 aulas por semana (configurável na tabela settings por migração administrativa), duração das aulas e cadastro de ocupação fixa
7. Para estudantes: definir finalidade, acesso, retenção, base de autorização e integração antes de ativar qualquer armazenamento

## Cloudflare e histórico

A integração GitHub/Cloudflare registrada usa a branch `main`, Worker `organizadordonicia` e banco D1 separado de prévia. Fazer merge pode disparar publicação. Consulte [o procedimento de deploy](docs/deploy.md) antes de alterar a integração ou executar comandos remotos. A autorização vigente de 11/10/2026 permite integrar e publicar etapas concluídas/verificadas no destino existente, conforme [AGENTS.md](AGENTS.md). Alterações de segurança, dados ou destino exigem revisão própria.

As primeiras versões de persistência, Cloudflare Access e Supervisão são documentadas em 06/10/2026. Totais antigos de testes são fotografias das respectivas revisões. O [CHANGELOG.md](CHANGELOG.md) e os PRs vinculados identificam as mudanças; resultados atuais devem apontar para o commit e a execução de CI correspondentes.

## Android conciliado nesta branch

Código nativo 1.0.1/versionCode 2 com ponte SGE 1.3.0, dois domínios e controles nativos preservados. Incorpora main e a organização por merges sem reescrever a branch original do PR10. Testes e exportação Hermes aprovados; não foi gerado APK/IPA novo nem feita validação física ou SGE autenticada. Veja [retomada](mobile-sge/RETOMADA.md).
