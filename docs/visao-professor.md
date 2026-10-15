# Visão de professor para a gestão

Direção, supervisão e orientação encontram **Visão de professor** no início da área da equipe, acima do conteúdo. O botão **Voltar à gestão** restaura a seção anterior. A escolha permanece durante recargas na mesma aba, usando `sessionStorage`; o navegador pode impedir essa persistência.

A prévia mostra Espaços, Xerox, Calendário, Formação e Solicitações. Usa a identidade atual: pedidos de xerox e solicitações pertencentes à própria conta; agenda com reservas próprias e ocupações aprovadas. Não seleciona nem representa outro funcionário. Listas vazias continuam vazias. Formulários podem ser inspecionados, mas salvar, editar, cancelar e remover ficam bloqueados enquanto a prévia estiver ativa.

A conta e suas permissões reais continuam sendo de gestão. A API conserva a autorização do servidor. Esta opção é uma prévia de interface, não uma fronteira de segurança nem prova de um login real de professor. Um professor continua entrando com sua própria conta autorizada e não recebe o botão de gestão.

## Verificações reproduzíveis

- `npm run validate`: lint, TypeScript, testes da raiz e mobile, build e consistência dos runtimes gerados.
- `node --test tests/portal-staff-ui.test.mjs`: três perfis de gestão, cinco seções, projeção dos registros, bloqueio de gravações, retorno, recarga, professor sem botão e transição concorrente.
- Workflow **Teacher preview QA**: Chromium em 320, 390 e 1440 px, banco SQLite descartável e direção fictícia; cliques, formulário desabilitado, retorno à seção anterior, recarga, cliques repetidos, ausência de erros e gravações de API.
- Execução equivalente no executor com Chromium instalado: `PUBLIC_QA_PLAYWRIGHT_DIR=/tmp/donicia-preview-playwright QA_CHROMIUM_PATH=/usr/bin/chromium node scripts/teacher-preview-qa.mjs`. Instalar a versão de Playwright fixada no workflow em diretório temporário antes, caso necessário.

Não foram usados logins ou registros pessoais de produção. O QA sintético não valida uma sessão institucional real nem o acesso autenticado ao SGE. Não há migração de banco nesta mudança. O retorno de publicação é conferido pela integração Cloudflare e pelo workflow HTTP público; a tela privada em produção depende de sessão autorizada.

## Resultado no executor cloud — 15/10/2026

Aprovados: `npm run validate` (188 testes raiz, 14 mobile, lint, TypeScript, build e runtimes), `npm run check:cloudflare` em dry-run e QA Chromium nas três larguras (320/390/1440), sem erros JavaScript ou gravações de API. A opção de prévia permaneceu após recarga e retornou à seção Tarefas. O dry-run não publica nem acessa o banco remoto.
