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

Não houve merge main, deploy de produção, migração remota, aplicação de rulesets, exclusão de branches ou publicação de releases. A conexão Cloudflare existente pode executar prévia ao abrir PR; ela usa banco isolado e não equivale a publicação em main. Antes do merge, exigir CI aprovada e autorização explícita de produção, conforme [deploy](deploy.md).

Após integrar a organização na branch Android, `npm run validate` (100+14 testes), exportação Android/iOS Hermes (604 módulos iOS) e Wrangler dry-run passaram em 11/10/2026. Nenhum novo APK foi criado.
