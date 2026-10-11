# Desenvolvimento e validação

Use Node.js 24 e npm. O SQLite nativo do Node é usado pelos testes; versões anteriores não representam o ambiente suportado. Instale versões dos lockfiles oficiais, sem copiar `node_modules` de outro projeto:

```sh
npm ci
npm --prefix mobile-sge ci
npm run validate
```

## Mapa do repositório

| Caminho | Responsabilidade |
| --- | --- |
| `src/index.html` | Interface web e JavaScript extraído pelo build |
| `src/worker.mjs` e demais módulos `src/` | API Workers, autenticação, regras e leitor SGE compartilhado |
| `sge-connector/` | Extensão Chrome/Edge e manifesto próprio |
| `mobile-sge/` | Aplicativo Expo/WebView, pontes, testes e lockfile independente |
| `migrations/` | SQL executável SQLite/D1, incluindo triggers revisados |
| `db/schema.ts`, `drizzle.config.ts` | Modelo e configuração Drizzle |
| `db/proposals/` | Propostas fora das migrações ativas |
| `scripts/`, `tests/` | Build, demonstração, validação e testes da raiz |
| `.github/workflows/` | CI, sem publicação de produção |
| `dist/`, `.local/`, `mobile-sge/.export/` | Saídas locais, não fontes a publicar no Git |

## Comandos e alcance

| Comando | O que verifica ou gera |
| --- | --- |
| `npm run lint` | Sintaxe JS/MJS/CJS com `node --check` e parsing JSX de `mobile-sge/App.js` via esbuild; não é auditoria de estilo ou segurança |
| `npm run typecheck` | TypeScript do esquema/configuração Drizzle na raiz |
| `npm test` | Suíte da raiz: API, autenticação, SQLite, regras, renderização e SGE |
| `npm --prefix mobile-sge test` | Contratos de conexão/ponte móvel e integração com leitor/site |
| `npm run build` | Web em `dist/index.html`/`app.js` e extensão em pasta/ZIP |
| `npm --prefix mobile-sge run build:runtime` | Regenera as duas pontes JavaScript injetadas |
| `npm run runtime:check` | Confere se regenerar os runtimes altera as fontes versionadas |
| `npm run validate` | Lint, typecheck raiz, testes raiz/móvel, build e consistência dos runtimes |
| `npm --prefix mobile-sge run check:bundle` | Exportação Expo Android/iOS; etapa separada da CI |
| `npm run dev` | Demonstração fictícia em loopback com SQLite local persistente |
| `npm run check:cloudflare` | Empacotamento Workers com Wrangler em dry-run; não migra nem publica |

O aplicativo móvel não possui typecheck TypeScript/checkJs configurado. Seu JSX é analisado no lint e seus bundles são validados pela exportação Expo. Não registrar essas etapas como typecheck móvel.

A CI usa Node 24 e lockfiles dos dois pacotes. `validate` e exportação são verificações complementares, sem secrets ou deploy automático. Para reproduzir toda a CI, rode ambos os comandos. Falhas de instalação/rede devem ser distinguidas de falhas de teste; não silencie erros nem atualize lockfiles indiscriminadamente.

## Fontes e arquivos gerados

O leitor compartilhado em `src/sge-reader.mjs` e os seletores em `src/sge-pages.mjs` alimentam extensão e aplicativo. Ao alterá-los ou mudar as pontes, execute:

```sh
npm --prefix mobile-sge run build:runtime
npm run runtime:check
npm run validate
npm --prefix mobile-sge run check:bundle
```

Revise e versione `mobile-sge/src/injected-runtime.js` e `injected-organizer.js` quando mudarem. Não edite esses arquivos manualmente. Não versione `dist/`, exportações, APK/AAB/IPA, credenciais ou dependências. O build deve manter a versão do manifesto no ZIP igual à fonte.

## Verificações manuais e limites

Antes de ampliar o uso ou distribuir uma versão, registre o commit, plataforma, data e resultado de cada verificação:

- Web: login institucional, perfis, seções, salvamento/recarga, tratamento de conflito e largura de tela.
- Extensão: versão instalada/detectada, sessão SGE no mesmo perfil, carregamento inicial, turmas, paginação, lista vazia, trimestre e relatório de falhas.
- Android físico: login no Organizador, sessão SGE, concluir conexão, consulta/seleção, links, botão voltar, interrupção/retomada e persistência. Testar APK assinado correspondente ao commit.
- iOS: exportação não comprova distribuição ou funcionamento físico; registrar assinatura e dispositivo quando disponíveis.
- D1: ensaio de backup/restauração em ambiente isolado; testes SQLite locais não comprovam recuperação de produção.

Evite escrever dados de teste em produção. Use prévia isolada para experimentos autorizados. Uma execução aprovada não autoriza merge, deploy, alteração Access ou migração remota; veja [deploy](deploy.md).
