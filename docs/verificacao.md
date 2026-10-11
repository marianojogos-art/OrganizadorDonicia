# Verificação da organização — 11/10/2026

Execução somente no executor cloud, checkout separado, origin `https://github.com/marianojogos-art/OrganizadorDonicia.git`. Base web `32b11d82ca1299d1a1c74ef49106caa7ed179b43`; base Android original `94039192cd47ad0e358107813a604c616fcf475f`. Nenhuma operação em Carijo ou computador pessoal.

| Verificação | Organização web | Android conciliado |
| --- | --- | --- |
| `npm ci` raiz e mobile (lockfiles) | Aprovado | Dependências fixadas compartilhadas no executor |
| `npm run lint` | Aprovado; sintaxe JS/MJS/CJS e JSX | Aprovado após integrar organização |
| `npm run typecheck` | Aprovado, esquema/configuração TypeScript | Mesmo escopo; aplicativo JS não tem typecheck configurado |
| `npm test` | 100 aprovados | 100 aprovados |
| `npm run test:mobile` | 12 aprovados | 14 aprovados |
| `npm run build` | Aprovado, web e ZIP conector | Aprovado |
| `npm run runtime:check` | Aprovado após regeneração | Aprovado após conciliação |
| `npm --prefix mobile-sge run check:bundle` | Android e iOS Hermes aprovados | Aprovado após integração |
| `npm run check:cloudflare` | Dry-run aprovado | Aprovado após integração |
| CI GitHub no SHA enviado | Consultar PR e Actions; local não substitui CI | Consultar PR e Actions |
| APK/AAB/IPA assinado deste código | Não executado | Não executado; export Hermes não é APK |
| Android/iOS físico; SGE autenticado 1.3.0 | Não executado | Depende de conta/sessão/dispositivo autorizados |
| Backup/restauração D1 | Não executado | Não executado |

A primeira verificação dos runtimes detectou arquivos gerados divergentes; ambos foram regenerados usando esbuild fixado e a repetição passou. O CI agora rejeita divergência. Instalação npm inicialmente falhou tentando gravar cache fora do workspace; repetida com cache em `/tmp` passou. Dry-run inicialmente falhou no diretório de configuração externo; repetido com `XDG_CONFIG_HOME=/tmp/donicia-xdg` e `WRANGLER_SEND_METRICS=false` passou. Esses caminhos são ajustes do executor, não falhas da aplicação nem acesso ao computador pessoal.

A conciliação Android preserva a branch original e incorpora ambos os históricos via merge, sem force-push. Único conflito inicial: `injected-runtime.js`, resolvido regenerando as fontes. A ponte informa protocolo/conector 1.3.0; suporte aos dois domínios, controles nativos e funcionalidades da main foram preservados. O relatório de APK 1.0.0 no README móvel é histórico, não evidência de compilação 1.0.1.

Na validação inicial não houve merge main ou deploy de produção. Rulesets, exclusões e releases continuam sem aplicação. A conexão Cloudflare existente pode executar prévia ao abrir PR; ela usa banco isolado e não equivale a publicação em main. A autorização posterior de 11/10/2026 permite integrar/publicar etapas verificadas; exigir CI aprovada e conferir resultado remoto, conforme [deploy](deploy.md).

Após integrar a organização na branch Android, `npm run validate` (100+14 testes), exportação Android/iOS Hermes (604 módulos iOS) e Wrangler dry-run passaram em 11/10/2026. Nenhum novo APK foi criado.

## Evidências remotas após integração

- Organização + habilidade: [PR12](https://github.com/marianojogos-art/OrganizadorDonicia/pull/12), merge `a2f66db9a63d1580e7f8fc71dd52f5bb848f20fb`. [CI main](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/38163316965) aprovada e [Workers Build produção a7852899](https://dash.cloudflare.com/b75c03c9aab21b66eff444a84203b885/workers/services/view/organizadordonicia/production/builds/a7852899-fd56-4fb0-ac35-085da3a2bd68) com conclusão `success`.
- Android conciliado: [PR13](https://github.com/marianojogos-art/OrganizadorDonicia/pull/13), merge `25a92efbf19847caf705bad21efd87da10c75590`. [CI main](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/38163425139) aprovada (`validate` e `mobile-bundle`). [Workers Build produção 3dae9896](https://dash.cloudflare.com/b75c03c9aab21b66eff444a84203b885/workers/services/view/organizadordonicia/production/builds/3dae9896-175f-4500-81b8-d9cda9d8c4e7) terminou `success` às 18:21:38 UTC em 11/10/2026. A integração existente executou o deploy; não foi duplicado manualmente.
- `git ls-remote` confirmou main `25a92ef` e a branch original Android ainda em `94039192cd47ad0e358107813a604c616fcf475f`. A cópia exportável da habilidade está contida no merge PR12 em `.agents/skills/sincronizar-projetos-github/`.
- Reexecução de `npm run validate` na main integrada: 100 testes raiz e 14 móveis aprovados, lint/tipagem raiz/build/runtimes aprovados.

Limite de publicação: o check da integração confirma sucesso do pipeline de produção para esses SHAs. Não foi possível consultar a [URL real](https://organizadordonicia.carijo.workers.dev/) pelo executor: proxy retornou `CONNECT tunnel failed, response 403`; a ferramenta web também não conseguiu abrir a URL, e não há credencial Cloudflare neste executor para consultar deployment/tráfego via API. Portanto não se afirma novo ID de deployment, 100% de tráfego, saúde funcional autenticada ou SGE real. Acesso/SGE não foram desativados para contornar a limitação.

Checkpoint privado cloud preservado em `/tmp/OrganizadorDonicia-checkpoint.bundle`, verificado com `git bundle verify`; histórico original main `32b11d8`/registro Cloudflare `d777092a` preservados. Para regressão, usar rollback no Worker existente com acesso autorizado ou commit de reversão específico; não force-push, apagar histórico ou reverter dados. Nenhuma regressão de código foi detectada nas verificações executadas e nenhum rollback foi necessário.
