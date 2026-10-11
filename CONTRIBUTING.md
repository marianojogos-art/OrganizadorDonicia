# Contribuir com o Organizador Donícia

Leia [AGENTS.md](AGENTS.md) antes de editar. O repositório é público: não inclua dados de estudantes/funcionários, HTML ou relatórios reais do SGE, tokens, cookies, senhas, sessões Expo, chaves de assinatura, bancos locais ou artefatos de distribuição. Use dados sintéticos em exemplos e testes.

## Fluxo de trabalho

1. Confira `git remote -v` e o SHA de `origin/main`. O alvo deve ser `marianojogos-art/OrganizadorDonicia`; mantenha outros projetos separados.
2. Atualize as referências e crie uma branch `codex/descricao` a partir da base apropriada. Preserve alterações de terceiros. Para conciliar Android, crie uma branch de integração e mantenha `app-android-1-0-1` sem reescrever seu histórico.
3. Instale dependências com `npm ci` na raiz e `npm --prefix mobile-sge ci`. Edite fontes; regenere runtimes quando o leitor/ponte mudar.
4. Execute as [validações](docs/desenvolvimento.md). Registre aprovado, falhou ou não executado, com motivo e SHA. Não apresente exportação como APK testado.
5. Revise `git diff --check`, `git diff` e arquivos novos. Atualize a documentação e o [changelog](CHANGELOG.md) quando o comportamento ou processo mudar.
6. Faça commits descritivos, envie a branch e abra PR **draft**, citando problema, comportamento final, verificações e limitações. Confirme o SHA remoto e a CI antes de informar que está sincronizado.

Commit, push e PR são permitidos no trabalho de organização. Merge na `main`, produção, migração remota, proteção/rulesets, remoção de branches e releases publicadas dependem de autorização específica. A integração Cloudflare pode publicar após um merge.

## Revisão

Alterações de API devem manter identidade, permissões, concorrência e transações. Migrações executáveis ficam em `migrations/`; alterações no esquema Drizzle não substituem revisão dos triggers SQLite/D1. A proposta de estudantes permanece fora das migrações ativas. Dados administrativos nominais ficam em `db/provisioning/`, ignorados pelo Git.

Correções do leitor SGE devem considerar extensão e ponte nativa. Mantenha os dois lados da conciliação Android: atualização da web não entrega um runtime novo a um aplicativo instalado. A CI não usa credenciais de produção e não deve ganhar permissão de escrita para executar testes.

Após a revisão, siga [deploy e plano de versões](docs/deploy.md). Limpeza de branches incorporadas deve usar inventário atualizado e confirmação, preservando branches com trabalho exclusivo.
