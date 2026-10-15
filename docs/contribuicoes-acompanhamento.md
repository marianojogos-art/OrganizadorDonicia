# Contribuições e atualizações publicadas

A aba **Contribuições** fica imediatamente depois de **Biblioteca**, no menu da equipe pedagógica. O histórico da própria aba resume etapas cuja publicação foi confirmada, com horário de Brasília, commit e link da execução Cloudflare. Datas não são inferidas de pedidos, planos, merges ou apenas de testes locais.

## Evidências das entradas do histórico

Consultadas no GitHub em 15/10/2026; os checks `Workers Builds: organizadordonicia` abaixo estavam concluídos com `success`:

| Commit | Publicação concluída (UTC) | Etapa registrada |
| --- | --- | --- |
| [`78497cc`](https://github.com/marianojogos-art/OrganizadorDonicia/commit/78497cc4e88b8329f895a73a98045da3c154b9d4) | 15/10/2026 02:17:51 | Ensaio isolado de recuperação e documentação dos limites; não comprova recuperação D1 de produção |
| [`90b00cf`](https://github.com/marianojogos-art/OrganizadorDonicia/commit/90b00cf18717c91e7d5ceb2f0eb1822e9f9cc246) | 15/10/2026 02:16:12 | Prévia somente leitura da visão de professor para gestão |
| [`09d91be`](https://github.com/marianojogos-art/OrganizadorDonicia/commit/09d91be22b0cf648fede9a3e03f2536719db6870) | 14/10/2026 22:39:43 | Métricas agregadas e contato institucional da secretaria já incluído nessa versão |

As duas primeiras datas aparecem como **14/10/2026** na interface, pois Brasília está três horas atrás de UTC. O histórico é um registro de etapas verificadas, não uma lista de todos os commits nem uma release do aplicativo Android. Novas entradas exigem confirmação da publicação antes de serem adicionadas.

## Acompanhamento das sugestões reais

Nesta execução, a consulta direta a `/api/feedback` não chegou ao aplicativo: o proxy do executor recusou o túnel HTTPS (`CONNECT tunnel failed`, HTTP 000 na consulta). Não há sessão institucional autenticada disponibilizada ao executor. As verificações HTTP anteriores confirmam que a rota privada redireciona usuários sem autenticação; não se deve remover essa proteção para obter a lista.

**Não foi possível ler, responder nem alterar sugestões reais nesta etapa.** Nenhum status de produção foi marcado como Implementada, e nenhum autor, texto ou registro foi reescrito. Exemplos dos testes são fictícios em SQLite descartável e não representam as contribuições da escola.

Quando houver acesso autenticado autorizado:

1. Ler todas as páginas e situações da lista; preservar IDs, autoria, texto original, datas e histórico. Não copiar dados pessoais para o repositório público.
2. Comparar cada pedido com o comportamento publicado e os limites verificados; registrar o que foi atendido e a evidência de publicação/teste.
3. Marcar **Implementada** somente quando o pedido completo estiver comprovado. Em atendimento parcial, explicar o que funciona e o que falta, mantendo uma situação que reflita a pendência.
4. Atualizar usando a versão corrente do registro; em conflito, reler e preservar o trabalho concorrente.
5. Conferir a persistência após recarga e registrar o resultado sem divulgar o conteúdo privado.

A interface/API atuais permitem mudar a situação da proposta, mas ainda não têm campo de resposta ou linha do tempo de comentários por contribuição. Portanto, para responder acompanhamento preservando histórico será necessário um mecanismo explícito de respostas; não usar o texto original ou um status como substituto de comentário. Essa parte não foi implementada implicitamente nem simulada como concluída.

## Verificação desta alteração

`npm run validate` verifica lint, TypeScript, testes raiz/mobile, build e runtimes. `scripts/feedback-qa.mjs` exercita dados fictícios, posição no menu, histórico aberto em 320/390/1440 px, ausência de rolagem horizontal, datas, links e preservação de autores/textos/datas dos exemplos. O histórico continua disponível se a consulta de contribuições falhar.
