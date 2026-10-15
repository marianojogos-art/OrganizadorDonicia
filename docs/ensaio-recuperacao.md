# Ensaio isolado de recuperação do banco

Em **15/10/2026**, o ensaio executado no computador virtual/nuvem passou. Foram usados somente arquivos SQLite temporários e registros fictícios. **Não foi uma recuperação do D1 remoto, nem uma comprovação de recuperação da produção.** Nenhum banco existente, credencial, dado de aluno, serviço pago ou configuração remota foi acessado.

## Reprodução

Com Node.js 24 e o checkout do projeto:

```sh
node --check scripts/recovery-drill.mjs
node scripts/recovery-drill.mjs
```

O workflow **Validação** também executa este ensaio em banco temporário a cada push/PR. O [script](../scripts/recovery-drill.mjs) usa apenas módulos nativos de Node, incluindo `node:sqlite`. Não precisa de instalação adicional, login, Wrangler, rede ou variáveis de ambiente. Cria seu próprio diretório `donicia-recovery-drill-*` no diretório temporário do executor; não aceita caminhos, bancos ou destinos como argumentos. Em caso de sucesso, imprime um relatório JSON; uma asserção que falhar encerra o processo com erro. Os bancos e o backup fictícios são removidos ao terminar, inclusive após falha. Não se deve adaptar esse script para receber um caminho de produção.

Para guardar o relatório da execução fora do Git:

```sh
node scripts/recovery-drill.mjs > /tmp/donicia-recovery-drill-result.json
```

O relatório contém nomes e SHA-256 das migrações, contagens e resultados, sem conteúdo das linhas. Não há banco, exportação SQL ou backup real a publicar no repositório.

## O que foi exercitado

1. Criar um banco vazio, com `PRAGMA foreign_keys=ON`, e aplicar os arquivos reais de `migrations/` em ordem, cada um em uma transação.
2. Depois da migração `0009`, inserir usuários, reservas, tarefa restrita, ocupação fixa, auxiliares, afastamento, substituições e auditoria **fictícios**. Assim, a reconstrução de `users` em `0010` é exercitada com vínculos preexistentes, e não somente com tabelas vazias. As migrações posteriores também são aplicadas.
3. Substituir os contatos públicos que as migrações preenchem por valores fictícios ou vazios. Os emails de teste usam o domínio reservado `example.invalid`. Não são usados nomes, contas, contatos ou conteúdos de produção.
4. Verificar integridade, ausência de violações de chaves estrangeiras e os vínculos entre reservas/usuários, tarefa/responsáveis e substituições/auxiliares/afastamento/criador. Versões, restrição da tarefa e indicação de substituição concluída também são conferidas.
5. Criar um backup consistente pelo mecanismo de backup SQLite (`node:sqlite.backup`), registrar tamanho e SHA-256 e inserir uma tarefa fictícia **posterior** ao backup.
6. Fechar e excluir somente o arquivo de origem criado pelo próprio ensaio. Reabri-lo vazio e confirmar que as tabelas foram perdidas nessa cópia descartável.
7. Restaurar o backup em outro arquivo SQLite temporário. Comparar todas as linhas das tabelas de aplicação e o esquema SQL explícito de tabelas, índices e triggers com o ponto do backup. Conferir novamente integridade e vínculos.
8. Confirmar que a escrita posterior ao backup **não** foi recuperada. Isso demonstra o limite do ponto de recuperação; o ensaio não promete perda zero para alterações posteriores.
9. Executar as verificações de conflito abaixo em savepoints, desfazendo cada tentativa. Ao final, conferir que os testes não modificaram os dados restaurados.

## Resultado observado

Base das migrações: commit [`09d91be`](https://github.com/marianojogos-art/OrganizadorDonicia/commit/09d91be22b0cf648fede9a3e03f2536719db6870). As mesmas migrações permanecem no commit de interface `90b00cf`; o ensaio é uma entrega separada da prévia de professor. Duas execuções independentes do script concluído passaram, com o mesmo resumo lógico e as mesmas 14 verificações.

| Verificação | Resultado da execução registrada |
| --- | --- |
| Ambiente | Executor cloud; Node `v24.19.0`; SQLite `3.53.3` |
| Migrações aplicadas | 14, de `0001_initial.sql` a `0014_site_metrics.sql` |
| Esquema conferido | 26 tabelas; 56 objetos explícitos de aplicação |
| Fixture principal | 2 usuários, 2 reservas, 1 tarefa, 1 ocupação fixa, 2 substituições, 1 afastamento, 1 registro de auditoria e vínculos auxiliares |
| Auxiliares | 5: 3 exemplos fictícios das migrações e 2 do ensaio |
| Backup SQLite | 290.816 bytes |
| Comparação após restauração | Esquema e todas as linhas idênticos ao ponto do backup |
| `PRAGMA integrity_check` | `ok` |
| `PRAGMA foreign_key_check` | Nenhuma violação |
| Vínculos e versões | Preservados |
| Tarefa criada após o backup | Não recuperada, conforme esperado |
| Conflitos/regras/revisões/rollback | 14 verificações aprovadas |
| Bancos temporários do ensaio | Removidos |
| Acesso ao D1 remoto | Não realizado |

SHA-256 do arquivo de backup fictício, calculado antes da remoção:

```text
d4811bb357687733e610aa6f25b3c080c3b882045de2c26808748d5f5c99ef44
```

SHA-256 do resumo canônico de esquema e linhas no ponto recuperado:

```text
4587b2d645f437f77ed9dd6ae264b6ec058c86d1e47502083a02856ca6603e62
```

Na execução registrada, a chamada de backup levou aproximadamente **0,367 ms**, e a de restauração, **0,405 ms**. São medições de arquivos fictícios pequenos no mesmo executor; não incluem um atendimento de incidente, obtenção de acesso, transferência, análise, retomada do aplicativo ou verificação humana. **Não representam RTO/RPO de produção.** Tamanho, hashes e tempos podem mudar com migrações, fixture ou versão do SQLite; a igualdade dentro de cada execução é o critério de sucesso.

As 14 verificações de regras foram:

- Inserção de reserva aprovada com sobreposição bloqueada.
- Alteração de reserva aprovada que criaria sobreposição bloqueada.
- Pedido pendente sobreposto permitido, mas aprovação conflitante bloqueada.
- Reserva contra ocupação fixa bloqueada.
- Ocupação fixa contra reserva aprovada bloqueada.
- Substituição conflitante para a mesma turma bloqueada.
- Auxiliar em horários simultâneos bloqueado.
- Vínculo com auxiliar inativo bloqueado.
- Limite semanal do auxiliar respeitado.
- Tarefa com proprietário inexistente bloqueada por chave estrangeira.
- Substituição com afastamento inexistente bloqueada por chave estrangeira.
- Situação inválida de tarefa bloqueada por `CHECK`.
- Alteração com versão antiga da tarefa afeta zero linhas; versão corrente funciona, e sua reutilização fica bloqueada.
- Alteração seguida de conflito dentro de uma transação/savepoint é integralmente desfeita.


## Limites e próxima validação necessária

O ensaio comprova a restauração SQLite do esquema e do conjunto sintético descritos. Não mede disponibilidade, retenção, bookmarks, permissões, exportação, recuperação pontual ou consistência distribuída do Cloudflare D1. Não reproduz o histórico administrativo `d1_migrations`, autenticação Cloudflare Access, configuração de secrets, deploy, anexos externos nem rotinas operacionais de um incidente. Tabelas sem dados na fixture tiveram seu esquema e seu estado vazio comparados; não houve cobertura funcional de todos os módulos do aplicativo.

Antes de declarar recuperação de produção validada, uma etapa separada deverá identificar o D1 e o mecanismo de recuperação existentes, registrar o ponto de recuperação e as permissões autorizadas, preservar a origem e realizar a restauração em destino isolado expressamente autorizado. Será necessário conferir esquema, histórico de migrações, contagens, vínculos, conflitos e fluxos autenticados do aplicativo, além de medir o tempo total de retomada e a janela de dados que seria perdida. Não substituir ou sobrescrever o banco de produção para fazer esse ensaio; novos recursos, custos e acesso a dados reais exigem o escopo e as autorizações correspondentes.

Este documento complementa o [guia de deploy](deploy.md), sem alterar suas instruções ou autorizar ações remotas.
