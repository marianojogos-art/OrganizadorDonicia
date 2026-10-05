# Organizador Donícia — candidato Cloudflare Workers

Projeto escolar independente para a EBM Donícia Maria da Costa. Não usa recursos, conta ou ferramentas operacionais da Lepidus. O Worker e o vínculo D1 estão configurados no repositório; o acesso e a publicação remotos dependem de autenticação na conta Cloudflare.

## Executar localmente

Requer Node.js 24 (SQLite nativo). Execute `npm ci` para instalar as versões fixadas, incluindo Wrangler:

- `npm run build`: gera `dist/index.html` e `dist/app.js` a partir de `src/index.html`
- `npm test`: testes de API com SQLite real local, JWT RSA e contratos de renderização
- `npm run dev`: demonstração em `http://127.0.0.1:8787`, somente loopback, com direção fictícia e SQLite em `.local/demo-v3.sqlite`

A identidade fixa do servidor de demonstração está exclusivamente em `scripts/dev.mjs`. O Worker de produção não tem bypass nem modo demo. Reiniciar o servidor preserva o SQLite local. Não inserir dados reais de estudantes ou funcionários na demonstração.

## O que funciona

- Reservas: criar, listar, editar e cancelar pelo responsável ou direção; impedir sobreposição no banco de forma atômica; ocupação semanal fixa com período de validade
- Tarefas: criar/editar/remover, prazo, responsável nominal, estados; somente direção delega ou restringe; restritas são filtradas no servidor
- Substituições: registrar/editar/remover aula ausente, cadastrar/editar/desativar auxiliares, distribuir/trocar/retirar auxiliar, limite semanal configurável e horários sobrepostos; duplicidade de turma bloqueada; desativação libera as aulas futuras de forma atômica
- Xerox: solicitar, aprovar/devolver/recusar, produzir/concluir, ajustar e reenviar pedido devolvido; transições concorrentes usam compare-and-swap
- Atas: direção registra/edita/remove; equipe autorizada consulta
- Calendário: direção registra/edita/remove; equipe autorizada consulta
- Estudantes: desabilitado, sem tabela ativa nem rota. Proposta sintética em `db/proposals/`, fora das migrações, para revisão futura

Durante uma gravação, o formulário permanece protegido contra fechamento ou troca acidental. Se o banco salva e a atualização da lista falha, a interface informa que a alteração foi salva e oferece atualizar, evitando repetir a gravação.

Edições e remoções usam a versão do registro para detectar mudanças concorrentes. Auditoria registra ator, método, rota e horário na mesma transação, sem copiar conteúdo pessoal. Somente direção consulta os últimos 100 eventos.

## Acesso

O candidato usa Cloudflare Access como fronteira de identidade humana, compatível com provedor Google institucional a configurar. O Worker verifica a assinatura RSA do JWT, emissor, audience, validade e domínio `@prof.sc.gov.br`. Isso não autoriza todo o domínio: o e-mail deve existir e estar ativo na tabela `users`.

Perfis iniciais: `direction` e `teacher`. As permissões são verificadas na API. A escola ainda precisa confirmar quem recebe cada papel e se supervisão precisa de perfil próprio. Usuários são provisionados por migração administrativa revisada; não existe cadastro aberto.

## Banco

`migrations/0001_initial.sql` é a fonte executável do esquema SQLite/D1 e dos triggers. `db/schema.ts` descreve as tabelas para Drizzle. Não usar o resultado de `db:generate` como substituto dos triggers revisados. O banco configurado é `donicia-school`, ID `e8a8a803-273b-42a6-bcc6-1aefeb78ad78`, binding `DB`. O estado remoto das migrações ainda precisa ser verificado na conta. Testes usam SQLite nativo, não o runtime D1.

Não há exportação de dados, uploads, anexos, notificações externas, importação SGE ou sincronização WebHorário. O link externo original permanece consulta manual.

## Antes de publicar

1. Confirmar conta Cloudflare autorizada, nome/projeto separado e domínio, preservando o site atual
2. Confirmar pessoas/perfis, política de tarefas restritas e responsáveis por aprovação de xerox
3. Criar recursos e configurar Access/Google apenas com autorização correspondente; preencher DB, ACCESS_ISSUER e ACCESS_AUD
4. Aprovar migração, provisionar usuários nominais, testar D1/Wrangler e login institucional real
5. Validar visual e fluxos em navegador desktop/mobile, CSP e recuperação do banco
6. Confirmar política escolar de 32 aulas por semana (configurável na tabela settings por migração administrativa), duração das aulas e cadastro de ocupação fixa
7. Para estudantes: definir finalidade, acesso, retenção, base de autorização e integração antes de ativar qualquer armazenamento

## Conectar GitHub e Cloudflare

No painel Cloudflare, abra o Worker `organizadordonicia` em **Workers & Pages → Settings → Builds → Connect** e selecione `marianojogos-art/OrganizadorDonicia`:

- Branch de produção: `main`
- Diretório raiz: `/`
- Versão de Node.js: `24` (variável de build `NODE_VERSION=24`)
- Comando de build: `npm run build`
- Comando de deploy: `npm run deploy:cloudflare`
- O token do build precisa de permissão para editar Workers e o banco D1 configurado, pois o deploy aplica migrações pendentes.

O nome do Worker no painel deve coincidir com `name` em `wrangler.jsonc`. O deploy usa Wrangler fixado no lockfile, gera os assets e aplica as migrações antes de publicar. Se o banco já foi inicializado manualmente por SQL, confira o esquema e o histórico `d1_migrations` antes de executar a migração inicial novamente; não apague tabelas para resolver um erro de tabela existente.

Em **Settings → Variables & Secrets**, configure as variáveis de runtime:

- `ACCESS_ISSUER`: URL do time Zero Trust, por exemplo `https://seu-time.cloudflareaccess.com`, sem barra final.
- `ACCESS_AUD`: Application Audience (AUD) da aplicação Access que protege este Worker.

`keep_vars: true` preserva essas variáveis do painel em novos deploys. Elas não recebem valores vazios do repositório. Variáveis de build não substituem variáveis de runtime. Sem configuração válida do Access e usuário nominal ativo no D1, o Worker recusa o acesso.

`workers.dev` e previews continuam desativados. Configure uma rota ou domínio protegido por Access; para usar `workers.dev`, configure a proteção Access e habilite essa rota também no arquivo Wrangler. Escolha o provedor Google institucional e uma política de acesso correspondente à equipe autorizada. O cadastro nominal na tabela `users` continua obrigatório, mesmo depois do login Google.

Para publicar pelo terminal após autenticar a conta:

```sh
npx wrangler login --device --browser=false
npm test
npm run check:cloudflare
npx wrangler d1 migrations list donicia-school --remote
npm run deploy:cloudflare
```

Referências: [Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/), [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) e [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

## Evidência e limites

Em 05/10/2026, os 25 testes locais passaram no Windows com Node.js 24, incluindo os fluxos HTTP e a persistência após reinício. O build separa JS para CSP. `wrangler deploy --dry-run` validou o pacote Worker, os dois assets e os bindings `DB`/`ASSETS` com Wrangler 4.147.0, sem publicação. Os testes de UI verificam renderização e contratos, não um navegador real. D1 remoto, login Google/Access, Drizzle generate e deploy efetivo ainda não foram verificados. O estado remoto será confirmado após autenticação na Cloudflare.
