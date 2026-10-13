# Deploy, validação e versões

A integração registrada conecta `marianojogos-art/OrganizadorDonicia` à branch de produção `main` do Worker `organizadordonicia`. O PR11 registra publicação; isso não é consulta atual ao painel. Fazer merge pode disparar deploy. A autorização vigente de 11/10/2026 permite integrar etapas concluídas/verificadas e publicar no Worker existente. PRs começam draft como controle interno de revisão. Regras de proteção, limpeza remota, releases publicadas, novos destinos e alterações destrutivas de dados continuam fora dessa autorização.

## Configuração e preparação

Confira no painel **Workers & Pages → organizadordonicia → Settings → Builds** o repositório, branch, diretório raiz, Node 24, comando de build e comando de deploy. Configurações do painel são externas ao Git; modificar o script no PR não comprova que uma política de proteção ou comando do painel já foi aplicado.

`wrangler.jsonc` define assets em `dist/`, binding `DB`, banco `donicia-school`, banco de prévia `donicia-school-preview`, `keep_vars: true` e `preview_urls: false`. Preserve o isolamento: falha na prévia não autoriza usar produção. URLs públicas de prévia estão desativadas; não desativar Access para facilitar teste.

`ACCESS_ISSUER` e `ACCESS_AUD` são variáveis de runtime do painel; `keep_vars` as preserva. Variáveis de build não as substituem. Cloudflare Access e usuário nominal ativo no D1 são necessários para a área de funcionários e APIs privadas. Nunca copie credenciais, JWT, cookies ou lista nominal para documentação pública. Use somente a autenticação já autorizada; não criar tokens durante esta organização.

Antes de publicar uma etapa autorizada:

1. Identifique o PR e SHA exatos, confira origin e alterações de migrações/versões.
2. Exija CI aprovada: validação conjunta e exportação móvel. Execute `npm run check:cloudflare` para conferir empacotamento Workers.
3. Revise as migrações pendentes e o plano de backup/recuperação. `migrations/` é a fonte SQL; geração Drizzle não substitui triggers revisados.
4. Planeje validação institucional/SGE e aparelho físico, com critérios de aceitação e responsável. Marque como não executado o que depende de acesso/dispositivo indisponível.
5. Confira o escopo autorizado em AGENTS.md; não pedir novamente aprovação de merge/deploy para a mesma etapa validada. Distribuição nativa, alterações destrutivas ou destinos novos exigem autorização própria.

## Publicação após autorização

`npm run deploy:cloudflare` valida o projeto, gera assets, aplica migrações remotas pendentes e publica. Não executar para testar. Listar migrações remotas também exige acesso à conta correta; alterar o D1 exige autorização.

```sh
# Somente na conta autorizada, após validar a etapa coberta pela autorização vigente:
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

## Portal público e acesso de funcionários

Este é o procedimento da etapa solicitada de acesso público. A autorização permanente de 11/10/2026 cobre integração e publicação no Worker existente após validação, conforme [AGENTS.md](../AGENTS.md) e a [habilidade de sincronização](../.agents/skills/sincronizar-projetos-github/SKILL.md); não é necessário pedir novamente aprovação de merge/deploy dentro desse escopo. Este plano não comprova que a configuração Access já foi alterada.

1. Revisar o PR, executar a validação conjunta da CI, o build e `npm run check:cloudflare`; revisar `0010_public_portal.sql` e ensaiar a atualização de um banco isolado na nuvem com registros sintéticos anteriores. Preservar a configuração atual do Access e uma referência de recuperação do D1 antes da alteração remota.
2. Configurar os destinos por hostname e caminhos na aplicação Access existente para os funcionários, preservando seu audience. A proteção do Worker inteiro também cobre a página inicial e precisa ser restringida aos caminhos privados para permitir acesso público; manter a proteção integral dos hostnames de prévia do Worker. A Cloudflare documenta a proteção por caminhos, inclusive em hostnames `workers.dev`, em [Cloudflare Access para Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).
3. Conferir o resultado esperado: `/`, `/public.html`, `/public.js` e `GET /public/api` livres; `/equipe`, `/equipe/`, `/equipe/app.js`, os aliases privados `/index.html` e `/app.js`, `/sge-connector.zip` e os caminhos `/api/*` protegidos. O endpoint público canônico fica fora de `/api`, permitindo manter uma única aplicação e o mesmo audience, sem uma exceção de bypass. O Worker conserva `/api/public` como alias de compatibilidade, mas esse caminho e `/api/health` ficam sujeitos ao Access na borda. Verificar os caminhos e a precedência conforme [Application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/); não liberar as demais APIs.
4. Manter uma política nominal de funcionários e garantir que o audience da aplicação de funcionários corresponda a `ACCESS_AUD`. Se a aplicação for recriada, atualizar o runtime antes da validação. A assinatura do JWT, o emissor, o audience, a validade e o usuário ativo continuam obrigatórios no Worker mesmo com o portal público.
5. Após a validação, conforme a autorização vigente, aplicar as migrações pendentes e publicar o código. Só liberar a entrada pública depois que a versão com separação de permissões estiver ativa e a aplicação Access de funcionários estiver pronta. O comando `npm run deploy:cloudflare` aplica migrações e publica; o merge em `main` também dispara esse fluxo.
6. Conferir em uma sessão anônima que o portal abre sem login e não retorna dados internos. Conferir login nominal como professor: quatro recursos disponíveis e chamadas diretas a tarefas, atas, substituições e Supervisão negadas. Conferir direção, supervisão e orientação com acesso completo, além de pedido de reserva pendente, aprovação e conflito de horário. Validar em cada hostname efetivamente publicado e manter as URLs públicas de prévia desativadas.
7. Completar os contatos escolares e o calendário de formação a partir dos dados fornecidos pela escola; publicar somente os avisos e eventos destinados ao público. Registrar commit, versão publicada e resultados da validação após concluir a operação autorizada. Nenhum dado privado nem credencial deve integrar o relatório público.

