# Orientações do projeto

- Registrar as mudanças de código, testes e documentação em commits e enviar ao GitHub. Esta é uma instrução permanente do usuário, recebida em 10/10/2026.
- Preferir branches `codex/` e pull requests para revisão. Verificar o envio remoto antes de informar que uma mudança está registrada no GitHub.
- Registrar no relatório final o link do commit ou pull request e a validação realizada. Se o envio falhar, comunicar o impedimento sem afirmar que houve sincronização.
- Não incluir senhas, tokens, credenciais de assinatura, bancos locais, dependências ou artefatos de distribuição gerados nos commits.
- Arquivos administrativos de provisionamento com dados pessoais ficam apenas localmente em `db/provisioning/`, fora do GitHub público. Não acrescentar dados pessoais de produção à documentação pública.
- O usuário autorizou explicitamente a publicação das melhorias da aba Supervisão em 10/10/2026, após revisar o registro no GitHub. Para novas mudanças, commit, push e pull request por si só não autorizam deploy, migrações remotas ou merge que dispare publicação; seguir a autorização vigente do usuário.

## Fluxo autorizado em 11/10/2026

- Antes de cada etapa, conferir origin e atualizações no GitHub; integrar preservando trabalho local e histórico de terceiros. Ao final, enviar commits relevantes incrementalmente e comprovar SHAs remotos.
- Trabalhar somente na nuvem. Não acessar computador pessoal sem pedido explícito ou autorização após explicar uma limitação.
- O usuário autorizou integrar etapas concluídas e verificadas na main e publicar no Worker Cloudflare existente para acompanhar a versão atual. Branches/PRs são ferramentas internas; não exigir que ele os gerencie nem teste localmente.
- Conferir CI, preservar checkpoint conhecido bom, verificar deployment/saúde e reverter com commit normal se houver regressão; nunca force-push na main.
- Essa autorização não inclui destruir dados, excluir branches remotas, contornar proteções, criar credenciais, custos ou destinos novos. Proteção/rulesets, limpeza e releases publicadas continuam propostas separadas. Código Android sem APK assinado/físico deve ser reportado como preparação.
