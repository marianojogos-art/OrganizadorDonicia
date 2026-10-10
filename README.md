# Organizador Donícia — Cloudflare Workers

## Supervisão por professor — 10/10/2026, sem publicação

Os resultados da Supervisão apresentam uma lista para selecionar o professor, indicadores individuais e planejamentos por trimestre. O relatório de ocorrências considera todos os registros do professor, inclusive os ocultos pelos filtros, e oferece download em texto. Consultas interrompidas ou com falhas também geram relatório. O botão “Aprovar no SGE” abre o registro em análise ou a lista do professor para concluir a aprovação no próprio SGE; uma nova consulta confirma a Situação.

As mudanças estão preparadas para revisão no GitHub, sem deploy ou aplicação de migrações remotas. O código anterior do conector, persistência e aplicativo móvel também é versionado para manter o histórico completo do projeto. Em 10/10/2026 passaram os 91 testes do site, conector e aplicativo móvel; os builds do site e runtimes móveis foram concluídos. A verificação visual no navegador permaneceu indisponível por restrição de acesso à ferramenta. A orientação permanente de registrar mudanças no GitHub está em `AGENTS.md`.

Projeto escolar independente para a EBM Donícia Maria da Costa. Não usa recursos, conta ou ferramentas operacionais da Lepidus. O GitHub está conectado ao Worker `organizadordonicia`, com build e publicação automáticos da branch `main`. O banco D1 remoto foi inicializado. O endereço é https://organizadordonicia.carijo.workers.dev, protegido por Cloudflare Access.

## Executar localmente

Requer Node.js 24 (SQLite nativo). Execute `npm ci` para instalar as versões fixadas, incluindo Wrangler:

- `npm run build`: gera `dist/index.html` e `dist/app.js` a partir de `src/index.html`
- `npm test`: testes de API com SQLite real local, JWT RSA no Node e no runtime Workers (Miniflare instalado com Wrangler), e contratos de renderização
- `npm run dev`: demonstração em `http://127.0.0.1:8787`, somente loopback, com direção fictícia e SQLite em `.local/demo-v3.sqlite`

A identidade fixa do servidor de demonstração está exclusivamente em `scripts/dev.mjs`. O Worker de produção não tem bypass nem modo demo. Reiniciar o servidor preserva o SQLite local. Não inserir dados reais de estudantes ou funcionários na demonstração.

## O que funciona

- Supervisão (publicada em 06/10/2026): seleção de turmas do SGE, consulta após confirmação, agrupamento por matrícula do professor, trimestres recolhíveis e síntese de Situação. O conector de navegador requer instalação e validação em uma sessão real; veja `sge-connector/README.md`.
- Reservas: agenda semanal por espaço, com navegação entre semanas, reservas e ocupações fixas no mesmo dia, e reserva direta da data escolhida; responsável nominal obrigatório, preenchido inicialmente com o usuário atual; criar, editar e cancelar pelo criador ou direção; impedir sobreposição no banco de forma atômica; ocupação semanal fixa com período de validade
- Tarefas: criar/editar/remover, prazo, responsável nominal, estados; somente direção delega ou restringe; restritas são filtradas no servidor
- Substituições: professores e aulas do WebHorário, busca por nome, dia atual e quantidade de dias corridos; prévia por turma/horário, auxiliar padrão para todas as aulas e divisão por aula; troca direta no quadro semanal, confirmação de realização e relatório com limite semanal; conflitos de turma e auxiliar bloqueados; desativação preserva aulas realizadas e libera as futuras ainda agendadas
- Xerox: solicitar, aprovar/devolver/recusar, produzir/concluir, ajustar e reenviar pedido devolvido; transições concorrentes usam compare-and-swap
- Atas: direção registra/edita/remove; equipe autorizada consulta
- Calendário: direção registra/edita/remove; equipe autorizada consulta
- Estudantes: desabilitado, sem tabela ativa nem rota. Proposta sintética em `db/proposals/`, fora das migrações, para revisão futura

Durante uma gravação, o formulário permanece protegido contra fechamento ou troca acidental. Se o banco salva e a atualização da lista falha, a interface informa que a alteração foi salva e oferece atualizar, evitando repetir a gravação.

Edições e remoções usam a versão do registro para detectar mudanças concorrentes. Auditoria registra ator, método, rota e horário na mesma transação, sem copiar conteúdo pessoal. Somente direção consulta os últimos 100 eventos.

## Acesso

A aplicação usa Cloudflare Access como fronteira de identidade humana. O login inicial usa código enviado ao e-mail institucional (One-time PIN), com política nominal para a conta de direção autorizada. A aplicação Access protege o Worker inteiro, incluindo todos os seus destinos. O Worker verifica a assinatura RSA do JWT, emissor, audience, validade e domínio `@prof.pmf.sc.gov.br`. Isso não autoriza todo o domínio: o e-mail deve existir e estar ativo na tabela `users`.

O JWT é lido do cabeçalho `Cf-Access-Jwt-Assertion` ou, quando o cabeçalho não está presente, do cookie de aplicação `CF_Authorization`. Ambos passam pela mesma verificação criptográfica. Isso permite autenticar quando o roteador de Static Assets não encaminha o contexto de identidade ao Worker. Cookies duplicados são recusados e um cabeçalho inválido não usa o cookie como alternativa.

A consulta às chaves públicas usa `redirect: 'manual'` e recusa respostas sem sucesso, incluindo redirecionamentos. O runtime Workers não aceita `redirect: 'error'`; essa opção interrompia a validação antes de consultar as chaves, mesmo depois de um login Access válido. O teste no Miniflare reproduziu a falha anterior e verifica login por cabeçalho e cookie, assinatura inválida e recusa de redirecionamentos. Diagnóstico opcional com `ACCESS_DIAGNOSTICS=1` registra somente códigos fixos de falha, sem JWT, cookies ou e-mail; fica desativado por padrão.

Perfis iniciais: `direction` e `teacher`. As permissões são verificadas na API. A escola ainda precisa confirmar quem recebe cada papel e se supervisão precisa de perfil próprio. Usuários são provisionados por migração administrativa revisada; não existe cadastro aberto.

## Banco

Os arquivos em `migrations/` são a fonte executável do esquema SQLite/D1 e dos triggers. `db/schema.ts` descreve as tabelas para Drizzle. Não usar o resultado de `db:generate` como substituto dos triggers revisados. O banco configurado é `donicia-school`, ID `e8a8a803-273b-42a6-bcc6-1aefeb78ad78`, binding `DB`. A migração inicial foi aplicada remotamente em 05/10/2026 e registrada em `d1_migrations`; os 13 triggers foram criados. As condições dos triggers usam `SELECT RAISE(...) WHERE ...`, pois o parser remoto falha ao separar lotes com `CASE ... END` dentro de triggers. A migração `0002_substitution_planning.sql` adiciona confirmação de aulas realizadas, cache da lista de professores e três auxiliares de exemplo: Ana, Beatriz e Carla, identificadas como fictícias. A migração `0003_webhorario_lessons.sql` guarda a grade de aulas, o período de ausência e o vínculo de cada aula com esse período, incluindo a disciplina. As migrações locais são aplicadas uma vez, preservando bancos de demonstração existentes.

## Usar reservas de espaços

Em **Reserva de espaços**, clique em **Ver agenda** no espaço desejado. A agenda mostra de segunda a domingo as reservas e os horários fixos válidos, ordenados pelo horário, com atividade e responsável. Use **Anterior**, **Próxima**, **Esta semana** ou o campo de data para consultar outro período. **Reservar neste dia** abre a nova reserva com o espaço e a data selecionados.

O campo **Responsável** é obrigatório e pode ser alterado na criação ou edição. O nome indicado aparece na agenda, nas próximas reservas e no resumo do dia. A conta que criou a reserva permanece registrada e controla as permissões de edição e cancelamento junto com a direção. A migração `0004_reservation_responsible.sql` preenche reservas antigas com o nome do criador e preserva os demais dados. A publicação deve aplicar essa migração antes de servir a nova versão.

## Usar substituições

Em **Substituições → Registrar ausência**, digite o começo do nome do professor e selecione uma sugestão (clique ou setas e Enter). O primeiro dia vem preenchido com o dia atual da escola. **Adicionar dias** escolhe uma quantidade de 0 a 30 dias adicionais; o total aparece ao lado. São dias corridos: por exemplo, sexta-feira mais 3 dias inclui sexta, sábado, domingo e segunda.

O sistema consulta a grade semanal e mostra, por dia, cada turma, atividade e horário que precisa de cobertura. Dias sem aulas aparecem sem criar substituições. A primeira auxiliar cadastrada vem selecionada para todas as novas aulas; mudar a auxiliar padrão aplica a escolha a todas. Para dividir as aulas de um mesmo dia, altere o seletor na linha de cada aula. Também é possível deixar aulas pendentes para distribuir depois.

Aulas já registradas são identificadas na prévia e preservadas; somente as aulas faltantes são adicionadas. Conflitos parciais precisam ser corrigidos no quadro semanal. Todos os registros novos e o período de ausência são salvos numa transação: conflito ou limite excedido cancela o lote inteiro. O servidor obtém turmas e horários da grade, valida as alterações individuais e recusa uma prévia que ficou desatualizada antes de salvar.

A grade é lida da [página pública da escola no WebHorário](https://www.webhorario.com.br/gradeporprofs.php?id=7829), versão `2026-08-20_15-40-49`: 34 entradas e 703 aulas semanais, incluindo duas duplas, resultam em 36 nomes individuais. A leitura verifica a quantidade de aulas publicada para cada professor e usa o horário escrito em cada célula, incluindo intervalos diferentes entre turmas. A última grade válida fica no D1 por 24 horas. **Atualizar grade** força nova leitura; se a fonte estiver fora do ar ou mudar de formato, a grade anterior permanece disponível com indicação de desatualização. Essa lista não cria usuários nem concede acesso ao sistema. A prévia corresponde à grade semanal publicada; mudanças pontuais podem ser ajustadas pela direção no quadro semanal.

O seletor de semana e os botões anterior/atual/próxima mostram as aulas e a carga de cada auxiliar. O seletor de auxiliar em cada linha troca a responsável por aquela aula, com verificação de versão, limite semanal e horários sobrepostos. **Marcar realizada** confirma uma aula de hoje ou de um dia anterior. O relatório distingue realizadas e agendadas, mostra total/limite e aulas disponíveis, e permite abrir o detalhamento de cada auxiliar. O limite considera ambas as categorias. Aulas realizadas mantêm o histórico mesmo após desativar a auxiliar; para trocar ou retirar sua responsável, desmarque a realização primeiro.

Não há exportação de dados, uploads, anexos ou notificações externas. A Supervisão consulta o SGE com um conector de navegador, mantendo os resultados temporários na tela.

## Antes de ampliar o uso escolar

1. Confirmar conta Cloudflare autorizada, nome/projeto separado e domínio, preservando o site atual
2. Confirmar pessoas/perfis, política de tarefas restritas e responsáveis por aprovação de xerox
3. Revisar novas políticas Access ou provedores de identidade antes de alterar a configuração inicial
4. Provisionar os novos usuários nominais e validar login institucional real; a migração inicial e o cadastro de direção já foram aplicados
5. Validar visual e fluxos em navegador desktop/mobile, CSP e recuperação do banco
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

`keep_vars: true` preserva essas variáveis do painel em novos deploys. Elas não recebem valores vazios do repositório. Variáveis de build não substituem variáveis de runtime. Sem configuração válida do Access e usuário nominal ativo no D1, o Worker recusa o acesso.

`workers.dev` está habilitado também no arquivo Wrangler; previews continuam desativados. A organização Zero Trust `Organizador Donícia` e a aplicação Access foram criadas, com proteção apenas deste Worker. `ACCESS_ISSUER` e `ACCESS_AUD` foram confirmados no runtime, preservando `DB` e `ASSETS`. Três contas nominais de direção estão ativas no D1 remoto: Mariano Melgarejo, Michele Rocha e Michel Caurio. O cadastro nominal continua obrigatório para qualquer usuário adicional, assim como a inclusão na política Access. Google institucional pode ser configurado posteriormente como outro provedor de identidade; o código não contém credenciais Google.

Para publicar pelo terminal após autenticar a conta:

```sh
npx wrangler login --browser=false --callback-host=127.0.0.1
npm test
npm run check:cloudflare
npx wrangler d1 migrations list donicia-school --remote
npm run deploy:cloudflare
```

Referências: [Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/), [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) e [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Evidência e limites

Em 06/10/2026, os 47 testes locais passaram no Windows com Node.js 24, incluindo autenticação e leitura da lista no runtime Workers, interações DOM do formulário, grade e horários do WebHorário, dias corridos, divisão por aula entre auxiliares, lotes de ausência atômicos, carga semanal, fluxos HTTP e persistência após reinício. O build separa JS para CSP. `wrangler deploy --dry-run` validou o pacote Worker, os dois assets e os bindings `DB`/`ASSETS` com Wrangler 4.147.0. A migração D1 foi aplicada remotamente e o Worker está publicado em `https://organizadordonicia.carijo.workers.dev/`, protegido pelo Access. Requisições anônimas são redirecionadas ao login institucional. Após publicar a correção da consulta de chaves, o usuário confirmou a abertura do sistema com seu login institucional; o diagnóstico temporário foi desativado. Os testes de UI verificam renderização e contratos, não um navegador real. Verificação visual desktop/mobile e Drizzle generate ainda não foram verificados.

## Publicação da Supervisão

Em 06/10/2026, a versão `cb53d961-10d4-4ec9-9b27-9e836caa3cb2` foi publicada no Worker `organizadordonicia`, incluindo a seção Supervisão e o conector de navegador disponível em `/sge-connector.zip`. Os 56 testes passaram antes da publicação. O deploy preservou os bindings D1 e Assets e as variáveis configuradas. Requisições anônimas ao aplicativo e ao ZIP retornaram o redirecionamento de login do Cloudflare Access. A navegação autenticada no SGE e a captura de links diretos ainda precisam de validação real.

### Correção de vínculos repetidos no SGE

Em 06/10/2026, foi publicada a versão `2dda17ae-b43e-4c34-8517-feb985619135`, corrigindo o erro “Página duplicada ou inválida na consulta”. O HTML da página 2 contém 72 posições de professores, mas 69 vínculos únicos: três pares de matrícula/disciplina aparecem repetidos. A leitura e a interface consultam cada vínculo uma vez; a API também aceita as repetições enviadas pelo conector anterior sem contar planejamentos duas vezes, preservando a validação contra identidades incompatíveis. Os 58 testes passaram, incluindo a regressão de consulta de duas turmas com vínculos repetidos. A correção funciona com o conector já instalado após recarregar o Organizador.

### Publicação de prévia, progresso e filtros de Situação

Em 06/10/2026, foi publicada a versão `d4783e1f-b86a-415c-8694-2fe628a11a74`, incluindo seleção das turmas de todas as páginas, progresso detalhado, prévia incremental e filtros por Situação gerais e por professor. Os 62 testes passaram. O conector 1.1.0 está disponível em `/sge-connector.zip`; para receber atualizações de cada planejamento, substituir os arquivos da extensão instalada e recarregá-la no navegador, depois recarregar o Organizador. A versão anterior continua funcionando com prévia ao concluir cada vínculo. O app e o ZIP continuam redirecionando requisições anônimas ao login institucional.

### Contas de direção autorizadas

Os cadastros nominais de direção e as políticas do Cloudflare Access foram verificados por leitura após a atualização administrativa. Os scripts locais de provisionamento com dados pessoais ficam fora do GitHub público e das migrações da demonstração.

Supervisão compartilhada: a migração 0005 armazena a última consulta por turma no D1 e controla uma revisão global para impedir sobrescritas concorrentes. A direção abre os resultados salvos sem SGE; consultas realizadas pelo conector atualizam o registro com data e responsável. Falhas preservam os registros anteriores. Atualizar por Situação usa a Situação salva e as turmas/professor selecionados, inclui novos registros e preserva datas dos demais. Registros não encontrados são mantidos com aviso. A síntese por professor apresenta contagens factuais para análise da supervisora. O conector 1.2.0 evita abrir os detalhes dos registros preservados; versões anteriores continuam compatíveis.
Publicada em 06/10/2026 a versão 9dbdd9ee-c69d-4f44-b7e7-7d3d61b08d36, com migração 0005 aplicada e 74 testes aprovados. Verificados o runtime D1 local e o redirecionamento institucional do site, da API de consultas salvas e do ZIP. O teste com a sessão real do SGE deve ser feito pela equipe ao iniciar a primeira consulta compartilhada.
Aplicativo móvel 1.0.0 em mobile-sge: abre o próprio site publicado e autentica pelo mesmo Cloudflare Access. A conexão nativa SGE usa o protocolo existente do site e o leitor compartilhado src/sge-reader.mjs; não existe banco móvel nem uma segunda implementação dos módulos. Os 86 testes do site/conector/app passaram e os bundles Android/iOS foram exportados. O link remoto do Expo entrega a versão 1.0.0. Os instaladores dependem da autenticação e assinatura na conta Expo/Apple.
