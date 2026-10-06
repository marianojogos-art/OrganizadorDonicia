# Organizador Donícia — Cloudflare Workers

Projeto escolar independente para a EBM Donícia Maria da Costa. Não usa recursos, conta ou ferramentas operacionais da Lepidus. O GitHub está conectado ao Worker `organizadordonicia`, com build e publicação automáticos da branch `main`. O banco D1 remoto foi inicializado. O endereço é https://organizadordonicia.carijo.workers.dev, protegido por Cloudflare Access.

## Executar localmente

Requer Node.js 24 (SQLite nativo). Execute `npm ci` para instalar as versões fixadas, incluindo Wrangler:

- `npm run build`: gera `dist/index.html` e `dist/app.js` a partir de `src/index.html`
- `npm test`: testes de API com SQLite real local, JWT RSA no Node e no runtime Workers (Miniflare instalado com Wrangler), e contratos de renderização
- `npm run dev`: demonstração em `http://127.0.0.1:8787`, somente loopback, com direção fictícia e SQLite em `.local/demo-v3.sqlite`

A identidade fixa do servidor de demonstração está exclusivamente em `scripts/dev.mjs`. O Worker de produção não tem bypass nem modo demo. Reiniciar o servidor preserva o SQLite local. Não inserir dados reais de estudantes ou funcionários na demonstração.

## O que funciona

- Reservas: criar, listar, editar e cancelar pelo responsável ou direção; impedir sobreposição no banco de forma atômica; ocupação semanal fixa com período de validade
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

## Usar substituições

Em **Substituições → Registrar ausência**, digite o começo do nome do professor e selecione uma sugestão (clique ou setas e Enter). O primeiro dia vem preenchido com o dia atual da escola. **Adicionar dias** escolhe uma quantidade de 0 a 30 dias adicionais; o total aparece ao lado. São dias corridos: por exemplo, sexta-feira mais 3 dias inclui sexta, sábado, domingo e segunda.

O sistema consulta a grade semanal e mostra, por dia, cada turma, atividade e horário que precisa de cobertura. Dias sem aulas aparecem sem criar substituições. A primeira auxiliar cadastrada vem selecionada para todas as novas aulas; mudar a auxiliar padrão aplica a escolha a todas. Para dividir as aulas de um mesmo dia, altere o seletor na linha de cada aula. Também é possível deixar aulas pendentes para distribuir depois.

Aulas já registradas são identificadas na prévia e preservadas; somente as aulas faltantes são adicionadas. Conflitos parciais precisam ser corrigidos no quadro semanal. Todos os registros novos e o período de ausência são salvos numa transação: conflito ou limite excedido cancela o lote inteiro. O servidor obtém turmas e horários da grade, valida as alterações individuais e recusa uma prévia que ficou desatualizada antes de salvar.

A grade é lida da [página pública da escola no WebHorário](https://www.webhorario.com.br/gradeporprofs.php?id=7829), versão `2026-08-20_15-40-49`: 34 entradas e 703 aulas semanais, incluindo duas duplas, resultam em 36 nomes individuais. A leitura verifica a quantidade de aulas publicada para cada professor e usa o horário escrito em cada célula, incluindo intervalos diferentes entre turmas. A última grade válida fica no D1 por 24 horas. **Atualizar grade** força nova leitura; se a fonte estiver fora do ar ou mudar de formato, a grade anterior permanece disponível com indicação de desatualização. Essa lista não cria usuários nem concede acesso ao sistema. A prévia corresponde à grade semanal publicada; mudanças pontuais podem ser ajustadas pela direção no quadro semanal.

O seletor de semana e os botões anterior/atual/próxima mostram as aulas e a carga de cada auxiliar. O seletor de auxiliar em cada linha troca a responsável por aquela aula, com verificação de versão, limite semanal e horários sobrepostos. **Marcar realizada** confirma uma aula de hoje ou de um dia anterior. O relatório distingue realizadas e agendadas, mostra total/limite e aulas disponíveis, e permite abrir o detalhamento de cada auxiliar. O limite considera ambas as categorias. Aulas realizadas mantêm o histórico mesmo após desativar a auxiliar; para trocar ou retirar sua responsável, desmarque a realização primeiro.

Não há exportação de dados, uploads, anexos, notificações externas ou importação SGE.

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

`workers.dev` está habilitado também no arquivo Wrangler; previews continuam desativados. A organização Zero Trust `Organizador Donícia` e a aplicação Access foram criadas, com proteção apenas deste Worker. `ACCESS_ISSUER` e `ACCESS_AUD` foram confirmados no runtime, preservando `DB` e `ASSETS`. Uma conta nominal de direção está ativa no D1 remoto. O cadastro nominal continua obrigatório para qualquer usuário adicional, assim como a inclusão na política Access. Google institucional pode ser configurado posteriormente como outro provedor de identidade; o código não contém credenciais Google.

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
