# Governança, branches e releases

Proposta de 11/10/2026; nenhuma proteção, exclusão, tag ou release foi aplicada. Base auditada: `32b11d82ca1299d1a1c74ef49106caa7ed179b43`.

## Branches incorporadas

| Branch | SHA remoto auditado | PR(s) | Ancestral da main |
| --- | --- | --- | --- |
| `codex/agenda-mensal` | `9b4c9392a4df16643f5da41d72a8a251642c4838` | [#8](https://github.com/marianojogos-art/OrganizadorDonicia/pull/8) | Sim |
| `codex/diagnostico-falhas-sge` | `a234fb18226d3824f08ea831fc5ff3cd752716d4` | [#2](https://github.com/marianojogos-art/OrganizadorDonicia/pull/2) | Sim |
| `codex/documentacao-atualizada` | `639cce2fc63f411f8db35af29a9771d9dace385a` | [#9](https://github.com/marianojogos-art/OrganizadorDonicia/pull/9) | Sim |
| `codex/fix-sge-com-br` | `80f15fe800cadf7ccfc9a11649aba72e948e38eb` | [#4](https://github.com/marianojogos-art/OrganizadorDonicia/pull/4), [#5](https://github.com/marianojogos-art/OrganizadorDonicia/pull/5), [#6](https://github.com/marianojogos-art/OrganizadorDonicia/pull/6) | Sim |
| `codex/mobile-layout` | `3cfb2465c9d448f9d7c28b136088d0979bc87a8c` | [#7](https://github.com/marianojogos-art/OrganizadorDonicia/pull/7) | Sim |
| `codex/sge-about-blank-loading` | `455167a1e93bb6995ff6afffac191d764c998966` | [#11](https://github.com/marianojogos-art/OrganizadorDonicia/pull/11) | Sim |
| `codex/supervisao-professores-ocorrencias` | `dc5c6fce852e0742773193391a96d7237e4f1482` | [#1](https://github.com/marianojogos-art/OrganizadorDonicia/pull/1) | Sim |
| `codex/supervisao-subsecoes-reiniciar` | `dc6695205a2e5002a511527a57dba90582c5fc49` | [#3](https://github.com/marianojogos-art/OrganizadorDonicia/pull/3) | Sim |

Preservar `codex/app-android-1-0-1` (`94039192cd47ad0e358107813a604c616fcf475f`), PR10, e as branches de revisão desta organização. Na auditoria a branch Android continha trabalho exclusivo; seus commits foram incorporados pelo PR13 sem reescrita. Continua preservada por orientação do usuário e não é candidata à exclusão nesta tarefa.

Após aprovação específica para limpeza: executar `git fetch --prune origin`, confirmar origin e ponta atual de main; para cada candidata, confirmar novamente seu SHA, PR integrado e `git merge-base --is-ancestor <SHA> origin/main`. Se a ponta mudou ou não for ancestral, interromper para revisão. Criar `git bundle create ../OrganizadorDonicia-before-cleanup.bundle --all` e validar com `git bundle verify` antes da exclusão; bundle apenas em local cloud privado, sem publicação. Excluir individualmente com `git push origin --delete <branch>` só após aprovação; nunca usar lista cega ou remover Android. Conferir lista remota depois.

## Proteção proposta

O arquivo [main-ruleset.proposed.json](main-ruleset.proposed.json) é uma proposta revisável para main, não uma chamada à API. Revisar e aprovar depois que os dois checks aparecerem e passarem em PRs reais. Exigir PR e checks `validate` e `mobile-bundle`, branch atualizada, bloquear force-push/exclusão. Não há bypass proposto. Com proprietário único, iniciar com zero aprovações obrigatórias; exigir uma quando houver segundo revisor habilitado. Não exigir histórico linear: a conciliação Android preserva merge e ambos os pais. Verificar opções/plano do GitHub e identidade dos checks antes de aplicar.

A integração Cloudflare existente publica main automaticamente. A autorização de 11/10/2026 permite integrar/publicar etapas verificadas no destino existente; conferir migrações e janela D1 sem destruir dados. Alteração de segurança ou exclusão continua pendente. Actions usa somente `contents: read`, sem secrets, deploy, assinatura ou upload de APK.

## Plano de releases

Não existem releases/tags auditadas. CHANGELOG registra commits/PRs, sem criar retroativamente lançamentos. Depois de aprovar merge e publicação web, registrar commit, deployment Cloudflare, horário UTC, migrações e validação real do login/SGE. O pacote web continua 2.0.0; escolher eventual tag própria (por exemplo `web-v2.0.0`) somente após acordar convenção e conferir ausência de tag conflitante.

Conector 1.3.0: confirmar ZIP gerado, manifesto e ping; instalar/recarregar e testar leitura autenticada e seleção de trimestre. Eventual `connector-v1.3.0` deve apontar para o commit validado e incluir hash do ZIP, instruções e limitações.

Android 1.0.1: código conciliado não é APK entregue. Confirmar app.json/package/versionCode 2 e preservar project ID/package/signing key existentes. Gerar APK/AAB no EAS com conta autorizada e segredo de assinatura mantido fora do Git; registrar build ID, commit, versão, SHA-256 e certificado, sem credenciais. Validar atualização sobre 1.0.0 no aparelho, login, dois domínios SGE, leitura por trimestre, links, retorno/voltar e persistência. Só então propor `android-v1.0.1` e release publicada. iOS exige assinatura Apple e validação próprias; export Hermes não comprova IPA.

Não criar token, nova chave de assinatura ou release publicada para contornar credenciais ausentes.
