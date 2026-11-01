# Notas pessoais, AEE e sessões de navegador

## Comportamento entregue

**Minhas notas** está disponível para direção, supervisão, orientação e professores. O início da gestão e Meu dia do professor mostram até três notas recentes, com texto resumido, edição e os atalhos Nova nota e Ver todas. A lista completa permite criar, editar e remover notas. Nenhum perfil recebe permissão para ler notas de outros logins. A API fixa o dono pela identidade autenticada e mantém versões, auditoria e proteção de origem. A prévia de professor da gestão é somente leitura.

A Supervisão organiza Anos finais, Anos iniciais e AEE em grupos próprios. O AEE participa da coleta no navegador e no servidor, inclusive na busca pela escola inteira; turmas de apoio permanecem excluídas e professores auxiliares são preservados. A extensão SGE não foi alterada e nenhuma gravação no SGE foi realizada.

## Sessão de navegador

A configuração existente do Cloudflare Access estava em 8h. Após autorização explícita para todos os usuários, foi alterada para 720h (30 dias) em 01/11/2026, 00:29 (Brasília). A releitura confirmou HttpOnly, políticas e destinos sem mudanças. O link Sair encerra o acesso. Sessões emitidas antes da alteração podem conservar o vencimento antigo; limpar cookies ou abrir janela anônima exige nova autenticação. O portal não grava senha nem token em localStorage.

A validação confirma a configuração remota e as proteções do código, sem alegar um ensaio de 30 dias ou fechamento/reabertura de navegador físico.

## Validação na nuvem

- 261 testes web e 14 testes mobile aprovados, com lint, TypeScript, build, runtimes e bundle mobile.
- Testes de notas cobrem CRUD do professor, falsificação de dono ignorada, isolamento perante outros professores e direção, versões concorrentes, CSRF e execução em Workers/D1 com dados fictícios.
- Chromium: CRUD, persistência após recarga, privacidade entre contas e ausência de rolagem horizontal em 320, 390, 768 e 1440 px. A prévia da gestão conserva identidade e bloqueia escritas.
- QA da Supervisão em 320, 390 e 1440 px consulta dois rótulos de AEE, preserva seleção de categoria e verifica cancelamento e descarte de retornos tardios com conector simulado.
- Formação, aprovações, assistente, post-it, área pública e verificações HTTP pós-publicação aprovados. Não representa consulta a contas ou dados reais do SGE.

[Testes de notas](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/41269552040/job/124739309005), [Supervisão](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/41269551922/job/124739308610), [validação completa](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/41269552064/job/124739309096) e [HTTP de produção](https://github.com/marianojogos-art/OrganizadorDonicia/actions/runs/41269551952/job/124739308604).

## Publicação e reversão

[PR29](https://github.com/marianojogos-art/OrganizadorDonicia/pull/29), commit `f27d0b8b6987dd0011e874299566ff3e36a9e7f7`; publicação concluída em `2026-11-01T03:32:39.789Z` (00:32 em Brasília), build `f768730e-b813-4994-86a9-7ffd06c1f0d1`, deployment `5485799b-8ab9-4f24-a7d0-817bb50633eb`, versão `73d13cfb-4d76-46d1-8d99-2b7b6fbfcf23` em 100% do tráfego.

Checkpoint anterior saudável: commit `a83aaa9f06738886e558c6342652954f514203e6`, deployment `68e87365-5a78-4a4c-970a-bb98a8628fc9`, versão `6e51a249-6808-43db-afec-29d4ed4c946d`. Uma reversão deve usar commit normal específico e validação; a duração do Access é uma configuração operacional separada, com valor anterior 8h. Não houve migração de esquema ou remoção de dados de produção.

## Contribuições

Foram acrescentados 13 acompanhamentos e 13 auditorias, preservando pedidos e comentários anteriores. Situação conferida: 12 Implementadas, uma Em análise e uma Nova. A auditoria foi vinculada à conta institucional existente indicada pelo gestor e identifica a execução automática. Não foi criado usuário técnico. Dados privados permanecem no portal. [Procedimento](contribuicoes-acompanhamento.md).
