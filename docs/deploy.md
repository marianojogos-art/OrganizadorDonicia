# Deploy, validação e versões

A integração registrada conecta `marianojogos-art/OrganizadorDonicia` à branch de produção `main` do Worker `organizadordonicia`. O PR11 registra publicação; isso não é consulta atual ao painel. Fazer merge pode disparar deploy. A autorização vigente de 11/10/2026 permite integrar etapas concluídas/verificadas e publicar no Worker existente. PRs começam draft como controle interno de revisão. Regras de proteção, limpeza remota, releases publicadas, novos destinos e alterações destrutivas de dados continuam fora dessa autorização.

## Configuração e preparação

Confira no painel **Workers & Pages → organizadordonicia → Settings → Builds** o repositório, branch, diretório raiz, Node 24, comando de build e comando de deploy. Configurações do painel são externas ao Git; modificar o script no PR não comprova que uma política de proteção ou comando do painel já foi aplicado.

`wrangler.jsonc` define assets em `dist/`, binding `DB`, banco `donicia-school`, banco de prévia `donicia-school-preview`, `keep_vars: true` e `preview_urls: false`. Preserve o isolamento: falha na prévia não autoriza usar produção. URLs públicas de prévia estão desativadas; não desativar Access para facilitar teste.

`ACCESS_ISSUER` e `ACCESS_AUD` são variáveis de runtime do painel; `keep_vars` as preserva. Variáveis de build não as substituem. Cloudflare Access e usuário nominal ativo no D1 são necessários. Nunca copie credenciais, JWT, cookies ou lista nominal para documentação pública. Use somente a autenticação já autorizada; não criar tokens durante esta organização.

Antes de publicar uma etapa autorizada:

1. Identifique o PR e SHA exatos, confira origin e alterações de migrações/versões.
2. Exija CI aprovada: validação conjunta e exportação móvel. Execute `npm run check:cloudflare` para conferir empacotamento Workers.
3. Revise as migrações pendentes e o plano de backup/recuperação. `migrations/` é a fonte SQL; geração Drizzle não substitui triggers revisados.
4. Planeje validação institucional/SGE e aparelho físico, com critérios de aceitação e responsável. Marque como não executado o que depende de acesso/dispositivo indisponível.
5. Confira o escopo autorizado em AGENTS.md; não pedir novamente aprovação de merge/deploy para a mesma etapa validada. Distribuição nativa, alterações destrutivas ou destinos novos exigem autorização própria.

## Publicação após autorização

`npm run deploy:cloudflare` valida o projeto, gera assets, aplica migrações remotas pendentes e publica. Não executar para testar. Listar migrações remotas também exige acesso à conta correta; alterar o D1 exige autorização.

```sh
# Somente na conta autorizada, depois da aprovação de publicação:
npm run validate
npm --prefix mobile-sge run check:bundle
npm run check:cloudflare
npx wrangler d1 migrations list donicia-school --remote
npm run deploy:cloudflare
```

Se o esquema foi inicializado manualmente, confira `d1_migrations` e esquema antes de reaplicar uma migração; não apague tabelas para contornar erro. Não presumir que reverter código desfaz SQL. Em caso de falha, interrompa, registre o estágio, preserve o banco e revise a recuperação em ambiente isolado antes de qualquer ação destrutiva.

## Evidência após publicação

Registre commit publicado, deployment Cloudflare, status **Ready** e tráfego ativo. Confira login real, comportamento relevante, persistência e versão do ZIP. Se a extensão mudar, instale/recarregue o ZIP desse deployment e confira versão disponível/detectada. Não confundir build local, prévia, registro histórico ou resposta HTTP pública com funcionamento autenticado completo.

A web pode mudar no WebView sem novo instalador; os runtimes SGE nativos não. Para distribuir Android/iOS, é necessário gerar runtimes do commit, compilar com conta/assinatura autorizadas, registrar build, versão/versionCode ou buildNumber, SHA-256 do instalador e resultado no dispositivo. A CI Expo exporta bundles; não produz APK assinado nem testa aparelho.

## Plano de versões e releases

Não há tags/releases publicadas na referência auditada. O [changelog](../CHANGELOG.md) registra commits/PRs, sem tratá-los como releases. Preparação proposta, sujeita à revisão:

| Componente | Próximo passo | Critério para publicação |
| --- | --- | --- |
| Web `2.0.0` | Integrar organização/testes via PR aprovado; identificar deployment pelo SHA | CI aprovada, autorização, migrações revisadas e smoke test institucional |
| Conector `1.3.0` | Distribuir ZIP da fonte integrada; evitar novo número sem alteração correspondente | Manifesto/ZIP/ping coerentes, instalação e consulta SGE real |
| Android `1.0.1` proposto | Conciliar PR10 em branch separada sem reescrever a original | Testes/bundles, runtime consistente, APK assinado e aparelho físico |
| iOS | Preparar somente quando houver conta/assinatura e escopo aprovados | Build/distribuição e validação física, sem inferir sucesso pela exportação |

Após aceitação, propor tags distintas por componente (`web-v…`, `connector-v…`, `android-v…`) apontando ao SHA exato e notas com diferenças, evidências e limitações. Escolher números web/conector na revisão, sem usar `2.0.0` repetidamente como release nova. Publicar tags/releases e anexar instaladores somente com autorização e artefatos verificados; jamais incluir chaves ou dados reais.

A configuração de proteção/rulesets e a limpeza de branches são planos separados. Antes de aplicar, confirme os nomes dos checks da CI, o inventário remoto atualizado e autorização. Preserve `app-android-1-0-1` enquanto houver trabalho exclusivo.
