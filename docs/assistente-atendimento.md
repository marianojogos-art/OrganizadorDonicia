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

## Pedidos das famílias e encaminhamento

Existe implementação real de registro privado em `0019_secretariat_requests.sql`, com formulário separado da pergunta ao assistente. Coleta somente assunto (documentos, vagas ou transferência), nome do responsável e telefone/e-mail de retorno, com revisão e autorização explícita. Não há campo para nome do aluno, documentos, anexos ou informações de saúde.

**A coleta fica desativada por padrão.** É necessário confirmar quem acompanha a triagem/encaminhamento antes de habilitar `SECRETARIAT_INTAKE_ENABLED=true` no Worker existente. Nenhuma ativação foi embutida em `wrangler.jsonc`. A fila foi preparada para direção, supervisão e orientação, que já possuem acesso administrativo; não se presume que uma conta da secretaria esteja provisionada. Professores e visitantes não podem listar os pedidos. O endpoint público GET informa apenas se a coleta está ativa, nunca retorna dados de pedidos.

O protocolo é um UUID e a criação é idempotente. Existe limite atômico por contato/dia e um teto global por hora. São limites básicos contra abuso, não prova de identidade de quem informa o contato. A equipe deve confirmar o contato antes de divulgar informações individuais. Não há consulta pública de protocolo.

Estados separados: **Registrado → Encaminhado → Atendido**. A criação apenas registra e disponibiliza à fila privada. O encaminhamento real é manual pelo canal confirmado da secretaria; não há integração de envio de e-mail/WhatsApp instalada. A equipe só marca Encaminhado após fazê-lo e fornece evidência; Atendido exige a etapa anterior e evidência. Alterações têm versão e auditoria. Nenhuma transição garante vaga, emissão de documento ou transferência. A aplicação não transmite essas solicitações a serviços de IA.

Pendência operacional: confirmar responsável nominal ou uso da equipe pedagógica como triagem, canal de encaminhamento e rotina de retenção dos dados de contato antes da coleta pública. Não se deve habilitar a entrada prometendo envio automático.

## Segurança e verificação

- Endpoints públicos e privados separados; o público recebe apenas uma capacidade de leitura com allowlist de duas fontes públicas. Nem cookies de funcionário ampliam esse escopo.
- O interno exige JWT verificado pelo módulo Access existente e usuário nominal ativo, incluindo nas ações. Não houve alteração das regras de autenticação nem ampliação dos papéis existentes.
- JSON e tamanho de corpo limitados; `Origin` verificado; não aceita papel, fonte, identidade, histórico ou contexto enviados pelo cliente. Respostas sem cache. Conteúdo exibido como texto, sem executar HTML.
- Perguntas não são persistidas nem encaminhadas externamente. Dados da conversa ficam em memória e são apagados ao fechar/limpar. Pedidos explicitamente confirmados persistem no banco privado; recibos de operações não guardam o texto.
- Testes sintéticos em `tests/assistant.test.mjs` e `tests/assistant-ui.test.mjs`: fontes públicas, rascunhos/expiração, usuários ativos, filtros por proprietário, perfis, XSS, origem/tamanho, falha de fonte, protocolo, quotas, estados, auditoria, retries e concorrência.
- `scripts/assistant-qa.mjs` executa navegador com SQLite descartável: três larguras, consulta pública, registro de família, xerox por conversa e fila interna. O workflow **Assistant QA** repete o ensaio no GitHub.

## API generativa pendente

A inspeção segura não encontrou `OPENAI_API_KEY` no ambiente ou em arquivos `.env` do checkout. A decisão de reutilização versus criação de chave permanece pendente, conforme a habilidade `openai-platform-api-key`. Nenhum segredo foi exibido, criado ou escrito; nenhuma chamada paga foi executada. Mesmo após resolver a credencial, enviar conteúdo sensível ou de menores a uma API depende de autorização específica e não está habilitado por este código.

## Publicação e recuperação

Base inspecionada: `d8169ddb7253c94cbd114d98b2f662039b2b1c8c`, main do GitHub, com validação e verificação pública aprovadas. O check Cloudflare desse commit confirmou o build saudável `d3bf5189-cf42-436c-8ea6-8d4d8990756c`. Publicação usa a integração existente da main com o Worker `organizadordonicia`. As duas migrações são aditivas, sem alterar registros ou permissões atuais. Reverter o código por commit normal restaura o comportamento anterior; as tabelas novas podem permanecer sem uso e não devem ser apagadas como parte da reversão. A coleta permanece desligada até decisão operacional.

Validação da implementação na nuvem: 247 testes web/backend e 14 móveis aprovados, lint, TypeScript, build, consistência de runtime e empacotamento Workers em modo dry-run. O navegador Chromium passou no ensaio sintético em 360, 768 e 1280 px. A consulta direta ao domínio de produção neste ambiente teve falha de DNS; por isso o job `live` do workflow Assistant QA verifica o domínio pelo GitHub, compara o SHA-256 do script servido com o checkout, consulta os três atalhos e confirma os redirecionamentos privados. O resultado do job, não sua simples criação, comprova a verificação em produção.

Testes locais e CI não comprovam login nominal real nem entrega à secretaria. Esses resultados devem ser relatados separadamente da publicação dos arquivos e da saúde HTTP pública.
