# Supervisão: seleção e controle da consulta

## Padrão e turmas

A opção numerada identificada foi **1º trimestre · março a maio**, no seletor **Trimestre da consulta**. Ela fica selecionada ao abrir e ao reiniciar a Supervisão. Os demais trimestres e Todos os trimestres continuam disponíveis; alterar o período não apaga resultados anteriores.

Cada categoria (Anos finais, Anos iniciais e Outras turmas) oferece Selecionar todas / Desmarcar todas. Uma seleção parcial passa a selecionar a categoria inteira; uma seleção completa passa a desmarcá-la. As outras categorias não mudam. A busca pela escola inteira mantém a seleção explícita de todas as turmas elegíveis e a exigência de identificar o professor.

Os rótulos ficam curtos, por exemplo **6º · 61 · Manhã**. Ano, código da turma e turno continuam distinguíveis. O título do botão mantém o nome original; em nomes abreviados iguais, o ID também aparece para evitar confusão. IDs e vínculos enviados à API permanecem iguais.

**Apoio e AEE são ignorados na seleção e na travessia de leitura.** O catálogo de turmas precisa ser enumerado para identificar os rótulos a excluir; nenhuma requisição de professores ou planejamentos é feita para essas turmas. AEE também é reconhecido pelo rótulo Atendimento Educacional Especializado. A filtragem ocorre na interface, na montagem do snapshot e na coleta da API, inclusive na busca por toda a escola. Professores auxiliares vinculados a turmas regulares continuam incluídos. Dados anteriormente salvos não são excluídos.

## Bloqueio, progresso e cancelamento

Durante a leitura de resultados salvos, descoberta de turmas e consulta de planejamentos, uma janela modal ocupa o primeiro plano. O restante da página fica `inert`, com navegação e cliques bloqueados; a janela mantém foco, permite percorrer seus controles por teclado e informa progresso com região de status acessível. Escape equivale a cancelar durante a leitura. O bloqueio é retirado em sucesso, erro ou cancelamento.

Cancelar durante a leitura invalida a operação: não abre novas consultas, não aceita progresso ou resultados posteriores e não envia um salvamento dessa busca. Leituras HTTP locais que permitem cancelamento usam `AbortController`. O restante do site é liberado imediatamente.

O conector 1.3.1 e a ponte mobile existentes não oferecem comando de interrupção física. Uma leitura já enviada pode continuar no navegador SGE; a Supervisão mantém o bloqueio de **nova consulta SGE** até essa resposta ou timeout terminar, evitando consultas sobrepostas. Isso não bloqueia o restante do site depois de cancelar. Retornos tardios não podem contaminar uma operação posterior.

**Limite da gravação:** depois que o POST de salvamento foi enviado, não há garantia de cancelamento ou desfazimento no servidor. Nessa curta fase, a janela informa que está salvando e aguarda sucesso/erro; não oferece um falso cancelamento. O cancelamento válido antes dessa fase impede o POST. Uma gravação já confirmada não é apagada nem revertida automaticamente. Não há garantia de interrupção física de consultas ou transações remotas já recebidas.

## Verificação

- `npm run validate`: lint, TypeScript, testes da raiz/mobile, build e consistência dos runtimes.
- Testes de Supervisão: trimestre padrão/reinício, grupos e IDs, AEE/apoio excluídos com auxiliares preservados, navegação bloqueada, cliques repetidos, leitura salva abortável, erro, cancelamento no ping/catálogo/professores/planejamentos e rejeição de retornos/gravações posteriores ao cancelamento válido.
- O teste mobile com fixture de outubro escolhe explicitamente o terceiro trimestre, depois de conferir o novo padrão 1; não depende mais da seleção anterior Todos os trimestres.
- Workflow **Supervision request QA**: Chromium em 320/390/1440 px, servidor e SQLite descartáveis e conector simulado com dados fictícios. Exercita seleção por categoria, trimestre 1, zero consultas de professores/planejamentos AEE, modal sem overflow, navegação bloqueada, cancelamento liberando o site, retorno tardio sem POST, sucesso e liberação após erro.

Reprodução no executor com Chromium instalado e Playwright temporário: `PUBLIC_QA_PLAYWRIGHT_DIR=/tmp/donicia-preview-playwright QA_CHROMIUM_PATH=/usr/bin/chromium node scripts/supervision-qa.mjs`. A CI instala a versão de Playwright fixada no workflow em diretório temporário.

Não houve consulta a SGE autenticado, uso de dados pessoais, alteração de registros reais, migração de banco ou mudança de credenciais/permissões. Testes sintéticos não confirmam a sessão real do SGE nem um APK em aparelho físico. A publicação segue a integração Cloudflare existente; a tela privada em produção depende de autenticação para inspeção.
