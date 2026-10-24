# Assistente de atendimento — primeira versão

O botão **Fale com o assistente** atende alunos e famílias na página inicial. **Assistente da equipe** fica na área autenticada. Esta versão consulta fontes locais e reconhece intenções por regras; não chama OpenAI nem outro serviço de IA. Não cria serviços, custos de API ou credenciais. Não oferece compreensão generativa irrestrita.

## Fontes e limites

- Público: projeções existentes de `/public/api` e `/public/content`: perfil escolar, avisos publicados vigentes, eventos públicos e descrições de projetos/documentos publicados. São apresentados trechos, datas existentes e links para a seção de origem. Não interpreta anexos nem acessa automaticamente links externos.
- Documentos, vagas e transferência: os três atalhos seguem as orientações já publicadas em `src/public.html#contatos` e documentadas em [fontes do portal](portal-publico-fontes.md). Não há confirmação de lista de documentos, vaga disponível, prazo ou transferência concedida. A secretaria esclarece os procedimentos pelos contatos publicados. A conversa de consulta não registra pedidos.
- Interno: consultas explícitas a calendário, formações, reservas, xerox, mensagens/materiais, tarefas, atas e notas. As APIs originais são chamadas no próprio Worker com a identidade já verificada; seus filtros de perfil e proprietário são preservados. Uma direção continua sem poder consultar notas pessoais de outro usuário.
- Ausência de correspondência ou falha de fonte é informada. Correspondência de palavras produz referências relacionadas, não uma afirmação de que a pergunta foi integralmente resolvida. A data da consulta não equivale à data de atualização do conteúdo.
- A manutenção dos textos publicados continua com a equipe. Publicar um texto não transforma seu conteúdo em prova independente; não existe rastreamento externo ou validação automática de fatos.

## Ações dos funcionários

| Intenção | Comportamento nesta versão | Confirmação |
| --- | --- | --- |
| “Quero reservar um espaço” | Pergunta espaço, data, início/fim, responsável e atividade; grava pela API de reservas | Revisão completa; professor cria pedido pendente, equipe pedagógica cria reserva aprovada, com aviso antes de confirmar |
| “Quero pedir xerox” | Pergunta título, cópias e prazo; grava pela API de xerox, sem anexo | Revisão e confirmação; anexos e opções avançadas continuam no formulário existente |
| “Quero enviar uma mensagem/material” | Pergunta tipo, assunto, turmas sem nomes de alunos, descrição e prazo; grava pela API de solicitações | Revisão e confirmação; nenhum e-mail é enviado |
| Criar tarefa, ata, nota, formação ou evento | Oferece o formulário existente, conforme perfil | Campos e gravação continuam no formulário; não há execução integral por conversa para essas ações |
| Consultar registros | Retorna trechos de até cinco registros autorizados e link para o menu | Somente leitura |
| Excluir, publicar, aprovar, editar ou executar Supervisão/SGE | Não implementado como comando de conversa | Usar os menus atuais e suas verificações |

`POST /api/assistant/execute` aceita somente `reservation`, `xerox` e `message`, com `confirmed:true`, campos enumerados e identificador de envio. Identidade, proprietário, validações e conflitos continuam no serviço existente. A migração `0020_assistant_operations.sql` guarda recibo de idempotência (hash do pedido, usuário e identificador), sem guardar texto da conversa. Recibo, registro e auditoria são confirmados na mesma transação. Repetir o mesmo envio retorna o registro original; reutilizar o identificador com dados diferentes é recusado. Uma falha não é apresentada como sucesso.

## Fila da Secretaria e recebimento público

**Publicar o código não ativa o recebimento público.** A migração `0023_secretariat_intake.sql` inicia a coleta desligada. `GET /public/secretariat-requests` informa somente `enabled`; enquanto desativada, POST retorna 503 e o assistente não apresenta formulário. Variáveis de ambiente e perfis não ativam a coleta.

A fila privada existente usa `0019_secretariat_requests.sql`. O acesso depende de uma concessão nominal em `secretariat_access`, vinculada a uma conta ativa; nenhum perfil, inclusive Direção ou Secretaria, recebe acesso automaticamente. `/equipe/secretaria`, seu script e a API verificam a mesma permissão no backend. O atalho **Fila da Secretaria** aparece na área de funcionários somente após verificação dessa permissão. O perfil original e suas demais funções são preservados.

A migração aditiva `0022_secretariat_access.sql` cria as concessões e o marcador de inicialização, sem inserir identidades. A tela `/equipe/secretaria/acessos`, disponível pelo atalho **Acessos da Secretaria** somente para Direção, lista contas ativas, exige seleção das três contas, revisão nominal e confirmação antes da concessão. Após consultar novamente as concessões, apresenta confirmação e botão separado para ativar o recebimento. A navegação não altera permissões nem ativa a coleta. A tela não consulta solicitações familiares.

A administração autenticada em `GET /api/secretariat-access` mostra apenas as concessões e o estado da inicialização, nunca solicitações familiares. `GET /api/secretariat-access/me` informa a permissão da própria conta.

`POST /api/secretariat-access` é uma inicialização única, restrita à direção, com `confirmed:true` e uma lista de exatamente três e-mails institucionais previamente confirmados. O backend exige que a lista corresponda exatamente ao cadastro ativo atual, com todas as três contas ainda em Direção. Mudança no conjunto ou perfil impede a operação. Concessões, marcador e auditoria são atômicos; repetir o mesmo conjunto não duplica registros, e substituir ou acrescentar contas após a inicialização é recusado. Contas futuras não recebem acesso; contas inativas não podem usá-lo. Identidades de produção não são incluídas neste repositório público.

Publicar o mecanismo não aplica concessões: a operação nominal deve ocorrer pela sessão autenticada existente e seu resultado deve ser verificado separadamente. Depois de verificar as três concessões, a direção com acesso individual pode executar `POST /api/secretariat-intake` com `confirmed:true, enabled:true`. A ativação é separada, explícita, atômica e auditada; retries não duplicam a auditoria. O mesmo endpoint permite suspensão com `enabled:false`. A coleta exige sempre as três concessões e contas ativas, inclusive na gravação, e fecha automaticamente se alguma delas perder o acesso. Não há alteração de regras do Access, criação de credenciais nem ampliação do domínio institucional.

Quando habilitado, o formulário coleta somente assunto (documentos, vagas ou transferência), nome do responsável e telefone/e-mail de retorno, com revisão e envio explícito. Não aceita nome do aluno, documentos, anexos ou informações de saúde. O protocolo UUID é idempotente. Há limite atômico por contato/dia e teto global por hora; esses limites não autenticam o contato. Não há consulta pública de protocolo. A confirmação significa registro na fila interna, sem afirmar atendimento ou concessão de vaga. Nenhum dado do formulário é enviado a IA ou canais externos.

Estados existentes: **Registrado → Encaminhado → Atendido**. A ação **Assumir na Secretaria** indica recebimento interno; **Confirmar atendimento concluído** registra a conclusão com observação. As alterações têm versão e auditoria. Não há transmissão externa ou envio a IA. Nenhuma transição garante vaga, emissão de documento ou transferência. Os testes usam exclusivamente pedidos fictícios inseridos em banco descartável; não criam pedidos reais.

## Segurança e verificação

- Endpoints públicos e privados separados; o público recebe apenas uma capacidade de leitura com allowlist de duas fontes públicas. Nem cookies de funcionário ampliam esse escopo.
- O interno exige JWT verificado pelo módulo Access existente e usuário nominal ativo, incluindo nas ações. Não houve alteração das regras de autenticação nem ampliação dos papéis existentes.
- JSON e tamanho de corpo limitados; `Origin` verificado; não aceita papel, fonte, identidade, histórico ou contexto enviados pelo cliente. Respostas sem cache. Conteúdo exibido como texto, sem executar HTML.
- Perguntas não são persistidas nem encaminhadas externamente. Dados da conversa ficam em memória e são apagados ao fechar/limpar. A fila existente permanece privada; novos pedidos públicos dependem de ativação explícita. Recibos de operações internas não guardam o texto da conversa.
- Testes sintéticos em `tests/assistant.test.mjs` e `tests/assistant-ui.test.mjs`: fontes públicas, rascunhos/expiração, usuários ativos, filtros por proprietário, perfis, XSS, origem/tamanho, falha de fonte, recebimento público condicionado à ativação, concessões individuais, preservação de perfis, estados, auditoria, retries e concorrência.
- `scripts/assistant-qa.mjs` executa navegador com SQLite descartável: três larguras, consulta pública inicialmente sem coleta, ativação e registro sintético com protocolo, xerox por conversa e fila interna por permissão individual mantendo o perfil Direção. O workflow **Assistant QA** repete o ensaio no GitHub.

## API generativa pendente

A inspeção segura não encontrou `OPENAI_API_KEY` no ambiente ou em arquivos `.env` do checkout. A decisão de reutilização versus criação de chave permanece pendente, conforme a habilidade `openai-platform-api-key`. Nenhum segredo foi exibido, criado ou escrito; nenhuma chamada paga foi executada. Mesmo após resolver a credencial, enviar conteúdo sensível ou de menores a uma API depende de autorização específica e não está habilitado por este código.

## Publicação e recuperação

Publicação usa a integração existente da main com o Worker `organizadordonicia`. As migrações 0019–0020 e 0022–0023 são aditivas; a 0021 ampliou somente o enum de perfil, sem atribuir acesso. As tabelas novas não devem ser apagadas em uma reversão. Uma reversão deve preservar as solicitações, o controle explícito de recebimento e as restrições individuais de acesso à fila.

A validação inclui testes web/backend e móveis, lint, TypeScript, build, consistência de runtime e empacotamento Workers em modo dry-run. O ensaio Chromium usa dados sintéticos em 360, 768 e 1280 px. O job `live` do workflow Assistant QA verifica o domínio pelo GitHub, compara o SHA-256 do script servido com o checkout, consulta os três atalhos, consulta o estado público de recebimento e os redirecionamentos privados. O resultado do job, não sua simples criação, comprova a verificação em produção.

Testes locais e CI não comprovam login nominal real nem aplicação de concessões. Esses resultados devem ser relatados separadamente da publicação dos arquivos e da saúde HTTP pública.
