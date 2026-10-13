# Organizador Donícia — Cloudflare Workers

Projeto escolar independente para a EBM Donícia Maria da Costa, publicado em [Organizador Donícia](https://organizadordonicia.carijo.workers.dev/). O GitHub está conectado ao Worker `organizadordonicia`, com build e publicação automáticos da branch `main`. Não utiliza recursos operacionais da Lepidus.

## Portal público e perfis — implementação de 13/10/2026

Esta revisão prepara o portal público e a separação de acessos. **A publicação, a migração remota e a alteração do Cloudflare Access ainda dependem de autorização específica; não foram executadas nesta implementação.** O estado de produção verificado anteriormente está registrado na seção seguinte.

| Acesso | Conteúdo e ações |
| --- | --- |
| Público, sem login, em `/` | Apresentação da escola, avisos publicados, calendário público e contatos. O link discreto **Acesso de funcionários** abre `/equipe`. |
| Professor, após login institucional | Pedidos de xerox, pedidos de reserva de espaço, calendário público e interno, calendário de formação por área. |
| Direção, supervisão e orientação, após login institucional | Acesso completo à gestão, incluindo aprovação de reservas e manutenção dos conteúdos públicos, calendário e formações. |

As permissões são verificadas na API: professores não podem consultar tarefas, atas, substituições, Supervisão, auditoria ou cadastros administrativos. Login válido também exige uma conta nominal ativa em `users`; não existe cadastro aberto. Os papéis técnicos são `direction`, `supervision`, `guidance` e `teacher`, com as mesmas permissões completas para os três primeiros neste momento.

A equipe publica avisos e edita apresentação e contatos em **Comunicação pública**. Avisos novos ficam como rascunho até a opção de publicação ser marcada. No **Calendário**, a equipe escolhe **Interno** ou **Público** por evento; eventos anteriores permanecem internos. `/api/public` expõe somente informações da escola, avisos publicados e eventos públicos, sem atas, contas, reservas, pedidos de xerox ou formações.

Em **Formação**, a equipe cadastra título, área, data, horários opcionais, local e observações. Professores consultam o calendário e filtram por área e mês. O calendário começa vazio e depende do documento oficial da escola para o cadastro dos encontros; nenhuma data ou área é preenchida como exemplo em produção.

A migração `0006_public_portal.sql` adiciona os novos perfis, conteúdos públicos e formações. Ela preserva os vínculos de usuários, marca reservas anteriores como **Aprovada** e eventos anteriores como **Interno**. O executor local aplica cada migração em uma transação, como o D1, inclusive a atualização da tabela de usuários.

Para publicar esta revisão após a autorização, revisar a seção **Publicar o portal público** abaixo. O Access que protege o Worker inteiro impede a navegação anônima até que a configuração dos caminhos seja ajustada.

Validação local desta revisão: **120 testes aprovados**, build concluído e `wrangler deploy --dry-run` aprovado. A suíte inclui autenticação no runtime Workers, migração com referências preservadas no D1, concorrência de aprovações, isolamento dos perfis, publicação explícita e formulários. Portal, dez seções pedagógicas e quatro seções do professor foram verificados no Chrome em 320, 390, 768 e 1366 px, sem rolagem horizontal ou erros JavaScript. Fluxos completos de pedido/aprovação, aviso e evento público/interno, contatos e Formação foram exercitados com dados fictícios em SQLite local. Isso não substitui a validação do login real após configurar o Access, nem equivale a teste em aparelho físico.

## Estado verificado após o PR8 — 10/10/2026

A base desta revisão é o commit de produção [`bcebc67`](https://github.com/marianojogos-art/OrganizadorDonicia/commit/bcebc67d1c3a75e59b9f53ad740ff0b425bed8ce). O deploy do PR8 foi confirmado como **Ready**, com **100% do tráfego**, versão Cloudflare com prefixo `bceb7364`. Os registros abaixo são uma fotografia dessa publicação, não uma consulta de status em tempo real.

| Componente | Versão / referência | Observação |
| --- | --- | --- |
| Site | `package.json`: `2.0.0`; publicação identificada pelo commit | O número do pacote não muda a cada PR; o commit e o deployment identificam o código publicado. |
| Conector Chrome/Edge | `1.2.3` em `sge-connector/manifest.json` | Distribuição em `/sge-connector.zip`, após login. Arquivos instalados neste PC e ZIP foram conferidos na publicação do PR6. |
| Aplicativo nativo | `mobile-sge/package.json`: `1.0.0` | Projeto separado; veja os limites de instalação e atualização em [mobile-sge/README.md](mobile-sge/README.md). Os PRs7/8 não geraram outro APK/IPA. |
| Banco de produção | `donicia-school` | Binding `DB`; cinco migrações versionadas. |
| Banco de prévia | `donicia-school-preview` | Isolado da produção; URLs públicas de prévia desativadas. |

### Mudanças publicadas

- [PR1](https://github.com/marianojogos-art/OrganizadorDonicia/pull/1), [PR2](https://github.com/marianojogos-art/OrganizadorDonicia/pull/2) e [PR3](https://github.com/marianojogos-art/OrganizadorDonicia/pull/3): resultados por professor, relatório de ocorrências, diagnóstico de falhas, subseções e reinício da Supervisão.
- [PR4](https://github.com/marianojogos-art/OrganizadorDonicia/pull/4), [PR5](https://github.com/marianojogos-art/OrganizadorDonicia/pull/5) e [PR6](https://github.com/marianojogos-art/OrganizadorDonicia/pull/6): conexão com os domínios do SGE, navegação inicial e leitura de listas vazias, incluindo paginação zero e grade oculta. Conector final `1.2.3`.
- [PR7](https://github.com/marianojogos-art/OrganizadorDonicia/pull/7): navegação e leiaute adaptados ao smartphone, tabelas por registro, campos maiores e formulários ajustados à altura da tela.
- [PR8](https://github.com/marianojogos-art/OrganizadorDonicia/pull/8): agenda mensal por espaço, seleção do dia, contagem de agendamentos e reserva com data/espaço preenchidos.

### Validação e limites atuais

- **94 testes da raiz aprovados** e `npm run build` concluído na versão do PR8. A suíte cobre API, autenticação, persistência, SGE, navegação móvel e agenda mensal, incluindo ano bissexto e virada de ano.
- As oito seções foram verificadas no navegador em 320, 390, 768 e 1366 px no PR7; a agenda mensal foi verificada nas mesmas larguras no PR8, sem rolagem horizontal da página. A verificação móvel usa emulação de viewport no Chromium, não um aparelho físico.
- Em produção, a visão mensal mostrou a reserva existente; alternância semana/mês, navegação entre meses e preenchimento da nova reserva foram conferidos sem criar dados de teste no banco de produção.
- A leitura real do SGE com o conector `1.2.3` foi concluída e os resultados salvos permaneceram após recarregar o site. Links diretos podem continuar indisponíveis conforme o comportamento do SGE; nesse caso, a interface oferece o acesso pela lista do professor.
- A suíte de `mobile-sge` e a geração dos runtimes foram executadas nesta revisão documental. Isso não equivale a gerar, instalar ou validar outro APK/IPA. Recuperação de backup D1, geração Drizzle e validação física completa do aplicativo nativo continuam sem nova evidência nesta revisão.

Orientações para contribuições e autorizações estão em [AGENTS.md](AGENTS.md). Alterações na `main` disparam publicação; registrar um PR não autoriza seu merge/deploy.

## Executar localmente

Requer Node.js 24 (SQLite nativo). Execute `npm ci` para instalar as versões fixadas, incluindo Wrangler:

- `npm run build`: gera o portal (`dist/public.html`, `dist/public.js`) e a área autenticada (`dist/index.html`, `dist/app.js`); os scripts são servidos em `/public.js` e `/equipe/app.js`
- `npm test`: testes de API com SQLite real local, JWT RSA no Node e no runtime Workers (Miniflare instalado com Wrangler), e contratos de renderização
- `npm run dev`: demonstração em `http://127.0.0.1:8787`, somente loopback, com direção fictícia e SQLite em `.local/demo-v3.sqlite`

A identidade fixa do servidor de demonstração está exclusivamente em `scripts/dev.mjs`. Para conferir os perfis locais, defina a variável de processo `LOCAL_ROLE` como `direction` (padrão), `supervision`, `guidance`, `teacher` ou `anonymous` antes de iniciar `npm run dev`. Essa opção nunca é lida de requisições ou cookies. O Worker de produção não tem bypass nem modo demo. Reiniciar o servidor preserva o SQLite local. Não inserir dados reais de estudantes ou funcionários na demonstração.

## O que funciona

- Supervisão: consulta de turmas pelo conector, resultados compartilhados salvos no D1, seleção por professor, filtros por Situação, trimestres, relatório de ocorrências e reinício da tela sem excluir os dados salvos. Veja [sge-connector/README.md](sge-connector/README.md).
- Reservas: agenda semanal e mensal por espaço; pedidos de professores ficam pendentes até aprovação da equipe; responsável nominal obrigatório; edição e cancelamento pelo criador ou equipe pedagógica; impedir sobreposição entre reservas aprovadas e ocupações fixas no banco de forma atômica
- Tarefas: equipe pedagógica cria/edita/remove, define prazo, responsável nominal, estados e restrição; professores não acessam esse módulo
- Substituições: professores e aulas do WebHorário, busca por nome, dia atual e quantidade de dias corridos; prévia por turma/horário, auxiliar padrão para todas as aulas e divisão por aula; troca direta no quadro semanal, confirmação de realização e relatório com limite semanal; conflitos de turma e auxiliar bloqueados; desativação preserva aulas realizadas e libera as futuras ainda agendadas
- Xerox: solicitar, aprovar/devolver/recusar, produzir/concluir, ajustar e reenviar pedido devolvido; transições concorrentes usam compare-and-swap
- Atas: exclusivas da equipe pedagógica, que registra/edita/remove e consulta
- Calendário: equipe pedagógica registra/edita/remove e define a visibilidade; professores consultam todos os eventos e visitantes somente os públicos
- Formação: equipe pedagógica mantém o calendário por área; professores consultam com filtros de área e mês
- Portal público: equipe pedagógica mantém apresentação, contatos e avisos, com controle explícito de publicação
- Estudantes: desabilitado, sem tabela ativa nem rota. Proposta sintética em `db/proposals/`, fora das migrações, para revisão futura

Durante uma gravação, o formulário permanece protegido contra fechamento ou troca acidental. Se o banco salva e a atualização da lista falha, a interface informa que a alteração foi salva e oferece atualizar, evitando repetir a gravação.

Edições e remoções usam a versão do registro para detectar mudanças concorrentes. Auditoria registra ator, método, rota e horário na mesma transação, sem copiar conteúdo pessoal. Somente a equipe pedagógica consulta os últimos 100 eventos.

## Acesso

A aplicação usa Cloudflare Access como fronteira de identidade humana da área de funcionários. O login inicial usa código enviado ao e-mail institucional (One-time PIN), com política nominal. Na última configuração de produção verificada, o Access protege o Worker inteiro, incluindo todos os seus destinos; a abertura do portal exige o ajuste descrito adiante. Para as rotas protegidas, o Worker verifica a assinatura RSA do JWT, emissor, audience, validade e domínio `@prof.pmf.sc.gov.br`. Isso não autoriza todo o domínio: o e-mail deve existir e estar ativo na tabela `users`.

O JWT é lido do cabeçalho `Cf-Access-Jwt-Assertion` ou, quando o cabeçalho não está presente, do cookie de aplicação `CF_Authorization`. Ambos passam pela mesma verificação criptográfica. Isso permite autenticar quando o roteador de Static Assets não encaminha o contexto de identidade ao Worker. Cookies duplicados são recusados e um cabeçalho inválido não usa o cookie como alternativa.

A consulta às chaves públicas usa `redirect: 'manual'` e recusa respostas sem sucesso, incluindo redirecionamentos. O runtime Workers não aceita `redirect: 'error'`; essa opção interrompia a validação antes de consultar as chaves, mesmo depois de um login Access válido. O teste no Miniflare reproduziu a falha anterior e verifica login por cabeçalho e cookie, assinatura inválida e recusa de redirecionamentos. Diagnóstico opcional com `ACCESS_DIAGNOSTICS=1` registra somente códigos fixos de falha, sem JWT, cookies ou e-mail; fica desativado por padrão.

Perfis desta revisão: `direction`, `supervision`, `guidance` e `teacher`. Direção, supervisão e orientação têm acesso completo por decisão da escola; professores têm somente os quatro recursos descritos acima. Usuários são provisionados por migração administrativa revisada; não existe cadastro aberto. Atribuir um perfil no D1 também exige que a pessoa esteja autorizada na política nominal do Access.

## Banco

Os arquivos em `migrations/` são a fonte executável do esquema SQLite/D1 e dos triggers. `db/schema.ts` descreve as tabelas para Drizzle. Não usar o resultado de `db:generate` como substituto dos triggers revisados. O banco configurado é `donicia-school`, ID `e8a8a803-273b-42a6-bcc6-1aefeb78ad78`, binding `DB`. A migração inicial foi aplicada remotamente em 05/10/2026 e registrada em `d1_migrations`; os 13 triggers foram criados. As condições dos triggers usam `SELECT RAISE(...) WHERE ...`, pois o parser remoto falha ao separar lotes com `CASE ... END` dentro de triggers. A migração `0002_substitution_planning.sql` adiciona confirmação de aulas realizadas, cache da lista de professores e três auxiliares de exemplo: Ana, Beatriz e Carla, identificadas como fictícias. A migração `0003_webhorario_lessons.sql` guarda a grade de aulas, o período de ausência e o vínculo de cada aula com esse período, incluindo a disciplina. As migrações locais são aplicadas uma vez, preservando bancos de demonstração existentes.

## Usar reservas de espaços

Em **Espaços**, clique em **Ver agenda** no ambiente desejado ou escolha o local no campo **Espaço** da agenda.

- **Semana**: mostra de segunda a domingo as reservas e os horários fixos válidos. Use **Anterior**, **Próxima**, **Esta semana** ou o campo **Semana de**.
- **Mês**: mostra o calendário mensal, iniciado na segunda-feira. Use **Anterior**, **Próximo**, **Este mês** ou o campo **Mês**. Cada dia informa a quantidade de reservas e horários fixos; essa quantidade não significa que o dia inteiro está ocupado.
- Selecione um dia no mês para consultar horários, atividades e responsáveis abaixo do calendário. A seleção permanece ao alternar as visões; a semana exibida acompanha o dia escolhido.
- **Reservar neste dia** abre o formulário com o espaço e a data selecionados. Informe início, término, responsável e atividade. Pedidos de professores ficam **Pendente**; reservas cadastradas diretamente pela equipe ficam **Aprovada**.

A equipe pedagógica pode **Aprovar** ou **Recusar** os pedidos. Somente reservas **Aprovada** ocupam o horário: pedidos pendentes podem coincidir, mas a aprovação é recusada se houver outra reserva aprovada ou ocupação fixa conflitante. Aprovações concorrentes para o mesmo horário resultam em uma confirmação e um conflito, sem dupla reserva. Professores podem editar seus pedidos pendentes ou recusados e reenviá-los como **Pendente**; a edição de uma reserva já aprovada cabe à equipe. Professores veem seus pedidos e as reservas aprovadas; pedidos pendentes ou recusados de outros professores ficam restritos à equipe e ao solicitante.

Os horários fixos só aparecem no dia da semana correspondente e dentro do período de validade. O calendário mensal inclui fins de semana e anos bissextos.

O campo **Responsável** é obrigatório e pode ser alterado na criação ou edição. O nome indicado aparece na agenda, nas próximas reservas e no resumo do dia. A conta que criou a reserva permanece registrada e controla as permissões de edição e cancelamento junto com a equipe pedagógica. A migração `0004_reservation_responsible.sql` preenche reservas antigas com o nome do criador e preserva os demais dados. Essa migração já faz parte do conjunto aplicado; o deploy aplica apenas migrações pendentes.

## Usar substituições

Em **Substituições → Registrar ausência**, digite o começo do nome do professor e selecione uma sugestão (clique ou setas e Enter). O primeiro dia vem preenchido com o dia atual da escola. **Adicionar dias** escolhe uma quantidade de 0 a 30 dias adicionais; o total aparece ao lado. São dias corridos: por exemplo, sexta-feira mais 3 dias inclui sexta, sábado, domingo e segunda.

O sistema consulta a grade semanal e mostra, por dia, cada turma, atividade e horário que precisa de cobertura. Dias sem aulas aparecem sem criar substituições. A primeira auxiliar cadastrada vem selecionada para todas as novas aulas; mudar a auxiliar padrão aplica a escolha a todas. Para dividir as aulas de um mesmo dia, altere o seletor na linha de cada aula. Também é possível deixar aulas pendentes para distribuir depois.

Aulas já registradas são identificadas na prévia e preservadas; somente as aulas faltantes são adicionadas. Conflitos parciais precisam ser corrigidos no quadro semanal. Todos os registros novos e o período de ausência são salvos numa transação: conflito ou limite excedido cancela o lote inteiro. O servidor obtém turmas e horários da grade, valida as alterações individuais e recusa uma prévia que ficou desatualizada antes de salvar.

A grade é lida da [página pública da escola no WebHorário](https://www.webhorario.com.br/gradeporprofs.php?id=7829), versão `2026-08-20_15-40-49`: 34 entradas e 703 aulas semanais, incluindo duas duplas, resultam em 36 nomes individuais. A leitura verifica a quantidade de aulas publicada para cada professor e usa o horário escrito em cada célula, incluindo intervalos diferentes entre turmas. A última grade válida fica no D1 por 24 horas. **Atualizar grade** força nova leitura; se a fonte estiver fora do ar ou mudar de formato, a grade anterior permanece disponível com indicação de desatualização. Essa lista não cria usuários nem concede acesso ao sistema. A prévia corresponde à grade semanal publicada; mudanças pontuais podem ser ajustadas pela direção no quadro semanal.

O seletor de semana e os botões anterior/atual/próxima mostram as aulas e a carga de cada auxiliar. O seletor de auxiliar em cada linha troca a responsável por aquela aula, com verificação de versão, limite semanal e horários sobrepostos. **Marcar realizada** confirma uma aula de hoje ou de um dia anterior. O relatório distingue realizadas e agendadas, mostra total/limite e aulas disponíveis, e permite abrir o detalhamento de cada auxiliar. O limite considera ambas as categorias. Aulas realizadas mantêm o histórico mesmo após desativar a auxiliar; para trocar ou retirar sua responsável, desmarque a realização primeiro.

A Supervisão permite baixar o relatório de ocorrências em texto e mantém consultas compartilhadas no D1 pela migração `0005_supervision.sql`. A prévia e os filtros também possuem estado local na tela. Não há envio de notificações externas nem fluxo de uploads/anexos.

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

## Conectar GitHub e Cloudflare

A conexão já existe entre o Worker `organizadordonicia` e `marianojogos-art/OrganizadorDonicia`. Para conferir, abra **Workers & Pages → organizadordonicia → Settings → Builds**. A configuração validada é:

- Branch de produção: `main`
- Diretório raiz: `/`
- Versão de Node.js: `24` (variável de build `NODE_VERSION=24`)
- Comando de build: `npm run build`
- Comando de deploy: `npm run deploy:cloudflare`
- O token do build precisa de permissão para editar Workers e o banco D1 configurado, pois o deploy aplica migrações pendentes.

O nome do Worker no painel deve coincidir com `name` em `wrangler.jsonc`. O deploy usa Wrangler fixado no lockfile, gera os assets e aplica as migrações antes de publicar. Se o banco já foi inicializado manualmente por SQL, confira o esquema e o histórico `d1_migrations` antes de executar a migração inicial novamente; não apague tabelas para resolver um erro de tabela existente.

As variáveis de runtime foram configuradas em **Settings → Variables & Secrets**. Se a aplicação Access for recriada, atualize:

- `ACCESS_ISSUER`: URL do time Zero Trust, por exemplo `https://seu-time.cloudflareaccess.com`, sem barra final.
- `ACCESS_AUD`: Application Audience (AUD) da aplicação Access que protege este Worker.

`keep_vars: true` preserva essas variáveis do painel em novos deploys. Elas não recebem valores vazios do repositório. Variáveis de build não substituem variáveis de runtime. Sem configuração válida do Access e usuário nominal ativo no D1, o Worker recusa o acesso à área de funcionários e às APIs privadas.

`workers.dev` está habilitado no arquivo Wrangler. As URLs públicas de prévia continuam desativadas (`preview_urls: false`); builds de prévia usam o D1 isolado definido no bloco `previews`. A organização Zero Trust `Organizador Donícia` e a aplicação Access foram criadas, com proteção apenas deste Worker. `ACCESS_ISSUER` e `ACCESS_AUD` foram confirmados no runtime, preservando `DB` e `ASSETS`. As contas nominais de direção são provisionadas administrativamente, fora do repositório público. O cadastro nominal continua obrigatório para qualquer usuário adicional, assim como a inclusão na política Access. Google institucional pode ser configurado posteriormente como outro provedor de identidade; o código não contém credenciais Google.

Para publicar pelo terminal, somente após autorização específica e a revisão do plano de acesso abaixo:

```sh
npx wrangler login --browser=false --callback-host=127.0.0.1
npm test
npm run check:cloudflare
npx wrangler d1 migrations list donicia-school --remote
npm run deploy:cloudflare
```

Referências: [Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/), [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) e [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Publicar o portal público

Este é um plano de publicação pendente, não um registro de configuração realizada. O [AGENTS.md](AGENTS.md) exige autorização vigente para deploy, migrações remotas e merge que dispare publicação. Commit, push e abertura de PR não executam essas etapas.

1. Revisar o PR, executar `npm test`, `npm run build` e `npm run check:cloudflare`; revisar `0006_public_portal.sql` e ensaiar a atualização de um banco local com registros anteriores. Preservar a configuração atual do Access e uma referência de recuperação do D1 antes da alteração remota.
2. Preparar uma aplicação Access do tipo self-hosted por hostname e caminhos para os funcionários. A proteção atual do Worker inteiro também cobre a página inicial e precisa ser substituída para permitir acesso público. A Cloudflare documenta a proteção por caminhos, inclusive em hostnames `workers.dev`, em [Cloudflare Access para Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).
3. Conferir o resultado esperado: `/`, `/public.html`, `/public.js` e `GET /api/public` livres; `/equipe`, `/equipe/`, `/equipe/app.js`, os aliases privados `/index.html` e `/app.js`, `/sge-connector.zip` e as APIs internas protegidos. `/api/health` é apenas diagnóstico público. Se for utilizada uma regra ampla `/api/*`, configurar a exceção específica de `/api/public` e verificar a precedência; as regras por caminho obedecem à especificidade, conforme [Application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/). Não liberar as demais APIs junto com a exceção pública.
4. Manter uma política nominal de funcionários e garantir que o audience da aplicação de funcionários corresponda a `ACCESS_AUD`. Se a aplicação for recriada, atualizar o runtime antes da validação. A assinatura do JWT, o emissor, o audience, a validade e o usuário ativo continuam obrigatórios no Worker mesmo com o portal público.
5. Com autorização, aplicar as migrações pendentes e publicar o código. Só liberar a entrada pública depois que a versão com separação de permissões estiver ativa e a aplicação Access de funcionários estiver pronta. O comando `npm run deploy:cloudflare` aplica migrações e publica; o merge em `main` também dispara esse fluxo.
6. Conferir em uma sessão anônima que o portal abre sem login e não retorna dados internos. Conferir login nominal como professor: quatro recursos disponíveis e chamadas diretas a tarefas, atas, substituições e Supervisão negadas. Conferir direção, supervisão e orientação com acesso completo, além de pedido de reserva pendente, aprovação e conflito de horário. Validar em cada hostname efetivamente publicado e manter as URLs públicas de prévia desativadas.
7. Completar os contatos escolares e o calendário de formação a partir dos dados fornecidos pela escola; publicar somente os avisos e eventos destinados ao público. Registrar commit, versão publicada e resultados da validação após concluir a operação autorizada.

## Histórico anterior

A persistência, autenticação por Cloudflare Access e primeiras versões da Supervisão foram publicadas em 06/10/2026. A migração `0005_supervision.sql` passou a guardar a última consulta por turma e uma revisão global para impedir sobrescritas concorrentes. Falhas preservam registros anteriores; atualizações por Situação mantêm as datas dos registros não relidos.

Os antigos totais de 47, 56, 62 e 74 testes descreviam etapas anteriores. Os 94 testes e os PRs listados no início deste arquivo são evidências da publicação do PR8; a revisão do portal possui sua própria validação no PR correspondente. A origem do projeto e as pendências estão em [REVIEW.md](REVIEW.md).
