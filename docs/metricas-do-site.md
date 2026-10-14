# Métricas do portal público

Métricas próprias do portal público e painel interno, sem serviço novo. A publicação no destino existente foi autorizada por Mariano em 14/10/2026, após a preparação local. Resultados de testes sintéticos não representam tráfego real. O registro da revisão deve informar separadamente o que foi implementado, validado ou permaneceu pendente.

## Escopo e significado dos números

A coleta se limita ao portal público. A navegação da equipe, seus formulários, documentos privados e operações administrativas não são instrumentados.

| Indicador | Definição | Limite de interpretação |
| --- | --- | --- |
| Visualizações | Eventos de abertura do portal aceitos pelo coletor | Recarregamentos e novas aberturas podem gerar visualizações adicionais. Não são pessoas. |
| Cliques em seções | Acionamentos dos controles de seção instrumentados, classificados por identificadores fixos | Não mede tempo de leitura, compreensão ou todas as formas de navegação. |
| Cliques em WhatsApp | Acionamentos de um contato WhatsApp configurado e instrumentado | Não confirma abertura do aplicativo, envio de mensagem, resposta ou atendimento. |
| Visitas estimadas (abas/dia) | Identificadores observados por aba e dia UTC, após deduplicação | Estimativa de abas/dia observadas, não identidade pessoal nem visitantes únicos no período. |

O total de visitantes estimados num intervalo é a soma das estimativas diárias. A mesma pessoa pode contribuir várias vezes ao usar mais de uma aba, navegador, aparelho ou dia. Abas duplicadas podem herdar o armazenamento de sessão em alguns navegadores. Esses efeitos impedem interpretar o total como número de pessoas distintas.

Somente eventos aceitos entram nos agregados. Bloqueadores, falta de JavaScript, falhas de rede/armazenamento, preferências de privacidade e limites de abuso podem reduzir os números. O filtro de bots é parcial: não identifica toda automação e pode excluir acessos legítimos.

## Coleta mínima e identificadores

O cliente usa um UUID aleatório em `sessionStorage`, separado de qualquer identificador de feedback. O identificador é renovado por dia UTC e fica restrito à sessão da aba. Não há cookie analítico nem identificador persistente entre dias planejado para esta coleta. Se não houver armazenamento ou geração segura disponível, não substituir por fingerprint, IP ou identificador pessoal.

Os eventos têm somente tipos e alvos de uma lista fixa. Cada ocorrência usa um UUID de evento para idempotência: repetir o mesmo envio aceito não deve aumentar a contagem novamente. O servidor calcula um SHA com escopo diário para deduplicação e limites; UUIDs brutos não são mantidos nos dados analíticos armazenados nem devolvidos pelo painel. SHA é um identificador técnico derivado, não uma prova de anonimato absoluto.

Não enviar ou persistir nestas tabelas nomes, e-mails, IPs, referrers, URLs completas, query strings, texto de páginas, mensagens de feedback, fotos ou conteúdo digitado. Não associar a sessão analítica a usuários autenticados, notas, tarefas ou feedback. A validação aceita apenas o contrato previsto; novos campos não devem ampliar silenciosamente a coleta.

O servidor de hospedagem recebe metadados de rede necessários à requisição HTTP. A ausência de IP nas tabelas analíticas não afirma ausência em infraestrutura, logs operacionais ou serviços externos. Evitar registrar corpos de requisição ou identificadores no diagnóstico da aplicação.

## Preferências de privacidade e bots

O cliente respeita Do Not Track (`DNT`) e Global Privacy Control (`GPC`) ativos, suspendendo a coleta. Não desativar essas preferências, pedir sua alteração ou tentar recuperar contagens por outra técnica. A página e os links precisam continuar funcionando quando a coleta estiver desabilitada ou falhar.

O User-Agent é usado transitoriamente para filtro básico de bots; não integra os agregados nem os identificadores armazenados. Esse filtro não é classificação confiável de pessoa e não autoriza coleta de impressão digital do navegador.

## Proteção contra contagens abusivas

O contrato limita o coletor a 20.000 eventos aceitos por dia UTC, no máximo 100 por sessão/dia (até 20 visualizações) e intervalo mínimo de dois segundos para o mesmo tipo de evento e seção da mesma sessão. Esses limites protegem recursos e podem subcontar cliques rápidos legítimos. Idempotência e limites devem ser conferidos no servidor, incluindo solicitações concorrentes; o comportamento do navegador não é uma barreira de segurança suficiente.

UUIDs aleatórios, limites por sessão e filtro de bots não impedem toda fraude: um cliente pode criar sessões novas. O teto diário limita eventos aceitos, não é um teto de operações faturáveis do D1; requisições recusadas também usam recursos. O armazenamento e os limites existentes continuam valendo, sem plano ou serviço novo. Uma contagem pública não deve ser usada para comprovar presença escolar, participação individual ou desempenho de estudantes/equipe.

## Retenção e painel

Os registros técnicos derivados para deduplicação/idempotência e controle de abuso são elegíveis à exclusão após 48 horas. Os agregados diários têm janela de 90 dias. A limpeza é oportunista, executada na próxima ingestão válida não classificada como bot; não há cron nem promessa de exclusão no instante do vencimento. Sem tráfego ou rotina agendada, limpeza acionada por requisição pode ocorrer somente na próxima execução. O relatório de testes deve identificar essa condição.

O painel é restrito aos perfis `direction`, `supervision` e `guidance`, com autenticação e autorização no servidor. Não basta ocultar seu menu. As respostas contêm agregados, sem IDs de sessão/evento ou linhas técnicas de deduplicação.

Filtros usam datas `from` e `to` em UTC, com intervalo de até 90 dias, sem aceitar datas inválidas ou ordem invertida. Dias são definidos em UTC, não necessariamente coincidem com a data escolar local nas horas próximas à meia-noite. Um dia sem contagem observada não comprova ausência de visitas; pode refletir bloqueios, falhas ou indisponibilidade.

## Validação e pendências

A validação deve usar dados sintéticos e banco isolado na nuvem. Cobrir contrato fechado de eventos/alvos, rejeição de campos indevidos, limites, concorrência, idempotência, renovação diária, retenção, preferências DNT/GPC, falha de armazenamento/rede, filtro de bots e autorização do painel. Conferir também que métricas nunca bloqueiam o portal e que o painel não expõe identificadores ou dados privados.

Os testes usam bancos sintéticos e mocks; não simulam visitas reais no banco de produção. A ativação acompanha a publicação autorizada. CI e verificação HTTP da main registram a conclusão do deployment separadamente.

As escolhas técnicas minimizam os dados previstos para esta função, mas não constituem declaração de conformidade legal. O portal mostra um aviso sobre esta coleta e permite desativá-la por aba; a instituição administra a finalidade e política de uso. Não existe inferência automática de consentimento ou dispensa de revisão jurídica a partir de DNT/GPC ou do uso de SHA.

## Operação e diagnóstico

`POST /public/metrics` recebe somente quatro campos: eventId, sessionId, event e section. `HEAD /public/metrics` verifica a existência da tabela e retorna 204 sem inserir eventos ou revelar contagens. `GET /api/site-metrics?from=...&to=...` retorna somente agregados para os papéis pedagógicos. O workflow HTTP verifica a rota pública, o módulo JS e o redirecionamento Access do painel sem login, sem criar visita sintética. A área privada não carrega o coletor público.

O cliente monta uma vez por documento; re-renderização não gera clique. Mouse/teclado usam o evento de ativação do link, sem interceptar navegação. Ativações programáticas explicitamente não confiáveis são ignoradas; a coleta é dispensável à página e falhas não impedem abrir o WhatsApp. Não há parâmetro de mensagem ou número no payload de métricas. O identificador do post-it é independente e nunca reutilizado.

## Evidências e reversão

Testes incluem contrato/limites, concorrência D1, retenção, autorização, coletor em mocks de navegador e painel por menu e link direto. Chromium conferiu painel desktop e móvel, totais de eventos sintéticos e botão WhatsApp exato, sem abrir conversa ou enviar mensagem. Nenhum tráfego de teste foi gravado no banco de produção.

O checkpoint anterior de código é `33af10f084d54fdfcba983fdd637360b4bd20966`. Reversão usa commit/deployment normal preservando dados e as tabelas aditivas; não apagar métricas ou contribuições como parte do rollback de código. A ausência do coletor em uma versão anterior simplesmente interrompe novas coletas.

Validação final da etapa: 184 testes da raiz e 14 móveis aprovados, lint/JSX, tipagem, build, runtimes e dry-run Wrangler. QA Chromium em 1365×950 e 390×844 conferiu os agregados de eventos exclusivamente sintéticos, as tabelas acessíveis e o opt-out; não abriu conversa no WhatsApp nem escreveu no banco de produção.
