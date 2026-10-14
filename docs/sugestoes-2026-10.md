# Sugestões de outubro de 2026 — fontes, reuso e limites

Preparação na nuvem em 14/10/2026, base `33af10f`. Esta etapa não autoriza push, merge ou deploy. A integração das doze sugestões está descrita adiante; implementação local, testes e publicação são estados distintos.

## Catálogo de referências oficiais

`src/resource-catalog.mjs` exporta `resourceCategories`, `resourceCatalog` e `getResourceCatalog(category)`. As categorias são `bncc`, `matriz` e `documentos`. Sem categoria retorna todos os recursos; filtro desconhecido retorna lista vazia. O catálogo é opcional e contém somente título, descrição e link: não baixa, copia, redistribui ou incorpora conteúdo de terceiros.

Fontes verificadas em 14/10/2026:

| Rótulo | URL oficial / evidência |
| --- | --- |
| BNCC — documento oficial do MEC | [PDF no MEC](https://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf): PDF acessível na consulta. O índice [BNCC/CNE](https://www.gov.br/mec/pt-br/cne/base-nacional-comum-curricular-bncc) apareceu na busca oficial, mas sua abertura apresentou desafio JavaScript/captcha; não é usado como prova de conteúdo integral. |
| Matriz de Referência Curricular 2026 — Anos Iniciais | [Arquivo Drive vinculado pela SME](https://drive.google.com/file/d/1qt7I_c2jUtvWr7K18JewdeGjkznhd7lo/view) |
| Matriz de Referência Curricular 2026 — Anos Finais | [Arquivo Drive vinculado pela SME](https://drive.google.com/file/d/1P9EtOwcIOgAXlM0k1nsdfxHQL_CKADkB/view) |
| Referencial Curricular de Educação Digital e Midiática 2026 | [Arquivo Drive vinculado pela SME](https://drive.google.com/file/d/1m2QQY6O0fLpbXnI4ZDdSeGEoRAH46sv9/view) |
| Política de Formação da RMEF 2026 | [Arquivo Drive vinculado pela SME](https://drive.google.com/file/d/1kDiLZnUkUOxmtns-pC6Amvtxi08wgXYp/view) |
| Portal da SME — formação e referências curriculares | [Portal Educacional](https://sites.google.com/sme.pmf.sc.gov.br/portaleducacional/forma%C3%A7%C3%A3o-continuada-ensino-fundamental) |

O portal da SME lista explicitamente as três referências curriculares de 2026 e a política de formação. Os destinos Drive exibiram título/visualizador e opção de login; não houve leitura integral validada desses documentos. A vinculação institucional foi comprovada, não o acesso anônimo integral. Trata-se de referências da rede de Florianópolis, não da matriz particular da Donícia. A matriz específica, PPP/regimento atualizado e formulários internos não foram fornecidos ou comprovados nesta pesquisa e não foram inventados.

A fonte municipal informa proteção autoral. Por isso a entrega mantém links para os originais e não extrai atividades, tabelas, imagens ou modelos. A data do catálogo é a data da conferência do vínculo, não garantia de atualização permanente do arquivo remoto. A abertura pode depender da conta institucional e das políticas Google.

## Contatos e WhatsApp

Busca no código e na documentação da base não encontrou canal WhatsApp institucional configurado. O [cadastro da Prefeitura](https://servicos.floripa.sc.gov.br/atendimento/servico-info/659) possui telefone/e-mail já registrados em `docs/portal-publico-fontes.md`; nesta nova abertura, o portal exigiu JavaScript. O telefone fixo existente não comprova WhatsApp e não deve ser convertido em `wa.me` automaticamente.

O [portal institucional — Quem somos](https://sites.google.com/sme.pmf.sc.gov.br/ebmdoniciamariadacosta/quem-somos) não ofereceu contato WhatsApp na leitura. O [portal histórico de 2020](https://sites.google.com/sme.pmf.sc.gov.br/ebmdoniciamariadacosta2020/p%C3%A1gina-inicial) menciona grupos de professores/famílias no contexto de atividades de 2020, sem comprovar número institucional atual ou autorização para divulgação. Redes Meta não foram usadas para inferir números.

Resultado inicial da pesquisa: nenhum número WhatsApp foi inferido. Posteriormente Mariano forneceu e autorizou o canal da secretaria: **+55 48 8873-4629**, usado exatamente como `https://wa.me/554888734629`, sem acrescentar um 9. É somente WhatsApp; não foi cadastrado como telefone de chamadas. Orientação permanece sem número e sem botão ativo. Falta o número institucional autorizado da orientação. O funcionamento do número da secretaria não foi validado por mensagem ou chamada. Não incluir números pessoais nem transformar menções históricas a grupos em um botão de contato atual. Configurar um número autorizado pode habilitar o link; o aplicativo não deve enviar mensagens automaticamente.

## Reuso das funções existentes

| Pedido / área | Base disponível | Limite a preservar |
| --- | --- | --- |
| Agenda | `events` já contém data, tipo, horários opcionais, local, detalhes, versão e visibilidade. Formações usam a mesma tabela com marcador `formation`. | Reusar registro e permissões; não criar segunda agenda nem duplicar formações. Público só quando explicitamente publicado. |
| Tarefas | `tasks` já possui responsável, prazo, estado e restrição; a API filtra acesso e faz validação/controle de versão. | Filtros e agrupamentos são projeções dos registros autorizados. Não alterar estados para produzir aparência de progresso. |
| Post-its / notas pessoais | `personal-notes.mjs` limita leitura/escrita ao usuário autenticado, sem exceção da direção; `notes` usa título, conteúdo e cor. | Feedback visual ou visão derivada deve ser somente leitura dos registros permitidos e não simular status real, aprovação ou conclusão. Não copiar dados de estudantes. |
| Biblioteca / documentos | Catálogo oficial desta etapa e eventual conteúdo interno autorizado são fontes distintas. | Não fabricar formulário padrão, PPP ou matriz da escola. Novos uploads precisam de autorização, limites e controle de acesso próprios. |

Esse diagnóstico é de arquitetura/reuso da base; não representa teste completo da UI que será implementada por outros responsáveis.

## Verificação desta parcela

`node --test tests/resource-catalog.test.mjs`: **3 testes aprovados**, cobrindo filtro, destinos HTTPS aprovados, identidade das categorias e imutabilidade. `node --check src/resource-catalog.mjs` e `git diff --check` restrito aos três arquivos: aprovados.

Não executados nesta parcela: validação completa da integração, navegador, login institucional, download integral de arquivos Drive, envio de mensagem, migração remota e deploy. Os testes são offline; a consulta web acima é a evidência separada dos vínculos oficiais.

## Integração preparada localmente — 12 pedidos

| Pedido | Implementação e limites |
| --- | --- |
| Cancelar busca na Supervisão | Invalida a operação e congela a prévia; ignora progresso/respostas tardias e não envia salvamento após cancelar. A trava permanece até a leitura enviada ao conector terminar. Não afirma abortar fisicamente o SGE. Salvamento já enviado recebe aviso e não oferece cancelamento impossível. |
| Separar turmas | Grupos Anos Finais, Anos Iniciais, AEE e outras identificações visíveis. Turmas Apoio são excluídas da seleção e no servidor; vínculos de professores auxiliares em turmas normais permanecem. |
| Ajustes e pendências | Atalhos de revisão/filtros usam somente as situações realmente retornadas, conservando seus rótulos. Não altera status no SGE. |
| Aviso durante busca | Mostra fase de leitura, prévia e salvamento, inclusive durante cancelamento e retorno atrasado. |
| Álbum | Privado para direção/supervisão/orientação, sem rota pública. JPEG/PNG até 256 KiB no D1 existente; confirmação explícita de uso autorizado e ausência de estudantes identificáveis para inclusão/substituição. Nenhuma foto escolar real foi enviada. |
| Agenda da equipe | Projeção dos eventos internos e formações existentes, por dia; novo compromisso interno usa a mesma tabela `events`. Não duplica registros nem cria eventos reais automaticamente. |
| Solicitar mensagem a turmas | Pedido interno com assunto, turmas/setor, texto proposto, prazo e acompanhamento; nenhum envio a WhatsApp, e-mail ou SGE. Professores consultam/editam somente seus pedidos pendentes. |
| Tarefas do dia | Filtro de hoje/atrasadas e todas; responsável/prazo existentes, mais verificador pedagógico designado. Apenas ele pode conferir uma tarefa concluída. Edição/reabertura invalida a conferência, com controle de versão. |
| Solicitar materiais | Mesmo fluxo de pedidos, categoria Materiais, descrição de itens/quantidades e prazo. Não faz compra, baixa de estoque ou compromisso financeiro automático. |
| Matriz e BNCC | Catálogo dos links oficiais acima, categorizado, sem cópias locais e sem declarar matriz própria da escola. |
| Documentos padrão | Biblioteca categorizada para cadastrar links HTTPS autorizados. Documentos oficiais de referência separados dos cadastros da escola. Formulários locais não fornecidos permanecem para cadastro pela equipe; não foram inventados. |
| WhatsApp em contatos | Botão de WhatsApp da secretaria com os dígitos exatos informados por Mariano; orientação vazia e sem botão ativo. Links no portal apenas quando um número autorizado é configurado. Fixo e e-mail anteriores preservados. |

### Permissões, armazenamento e migrações

As permissões pedagógicas existentes são preservadas. O professor ganha somente o fluxo novo de suas próprias solicitações, não acesso ao álbum, biblioteca administrativa, tarefas ou outras áreas pedagógicas. Direção/supervisão/orientação administram os cadastros e pedidos. Álbum e documentos não aparecem no endpoint público. Notas pessoais e contribuições reais não são alteradas.

`0012_staff_services.sql` cria `staff_requests`, `pedagogical_album` e `resource_library` com índices. `0013_task_review_contacts.sql` acrescenta verificador/conferência e WhatsApp; a secretaria é inicializada com o número autorizado e orientação fica vazia. Não remove dados ou tabelas, não provisiona serviço/bucket e não altera Access, audiência ou extensão SGE. Os novos campos da escola são públicos apenas como contatos institucionais configurados; sem número confirmado não há link.

Imagens passam por limite real, MIME/extensão e assinatura inicial, com limite adicional no SQL; isso não é antivírus nem análise de identidade. Download exige login e perfil pedagógico, envia `no-store`, `nosniff`, sandbox e disposição de anexo. Arquivos não são copiados ao GitHub. Administradores da infraestrutura continuam administrando o D1; não se promete criptografia de ponta a ponta. Para arquivos maiores ou acesso por novos papéis, é necessária decisão posterior; não há ampliação automática.

Listagens de pedidos, fotos e documentos mostram no máximo 500 registros cada. São cadastros novos inicialmente vazios; esse limite é exibido na interface. Não há busca global de conteúdo privado, coleta automática externa, envio de mensagens ou custos de novas integrações. URLs da biblioteca são abertas por escolha do usuário e nunca buscadas pelo servidor.

### Situação da entrega

Preparada em branch local para revisão e coordenação antes de push/publicação. Migrações remotas não executadas. O catálogo foi conferido em fontes oficiais; a verificação funcional usa dados sintéticos na nuvem. Login institucional, leitura SGE autenticada, números WhatsApp definitivos e documentos próprios da escola dependem dos acessos/conteúdos autorizados correspondentes, não de dados inventados.

### Evidência da integração completa

- `npm run validate`: **171 testes da raiz e 14 móveis aprovados**, sintaxe/JSX, tipagem, build e correspondência dos runtimes. Inclui as novas rotas executadas no Workers/Miniflare com D1, isolamento de dois professores, fotos privadas, CAS e auditoria.
- `npm run check:cloudflare`: dry-run aprovado usando diretório de configuração temporário na nuvem; não é deploy nem migração remota.
- Chromium headless: Solicitações, Álbum, Biblioteca, Agenda da equipe e Tarefas em 1365×900 e 390×844; nenhuma exceção JS ou transbordamento horizontal. Professor fez dois pedidos próprios; acesso ao álbum negado. Equipe fez upload pelo formulário de um PNG geométrico sintético 2×2, exibido pela rota privada, cadastrou um link fictício sem abri-lo, criou compromisso interno fictício e conferiu tarefa atribuída ao próprio verificador.
- Supervisão: testes específicos cobrem cancelamento em ping/lista/professores/planejamentos, progresso e erros atrasados, trava de concorrência, fase de salvamento não cancelável, agrupamentos e preservação do auxiliar. Não houve consulta SGE autenticada ou escrita no SGE.
- Solicitações seguem Pendente → Em análise/Aprovada/Recusada, Em análise → Pendente/Aprovada/Recusada, Aprovada → Concluída/Recusada; Recusada pode voltar a Pendente pela equipe. Concluída não reabre diretamente. Os rótulos são do fluxo interno e não representam entrega externa.

CI remoto e publicação desta etapa **não executados**, conforme coordenação solicitada. Não houve acesso ao computador pessoal, uso de fotos reais, criação de credenciais, alterações nos registros reais de Contribuições ou chamadas pagas. O canal da orientação e os documentos próprios continuam dependendo de cadastro institucional autorizado; a funcionalidade para cadastrá-los está pronta localmente.

### Ajuste do contato da secretaria

Botão com nome acessível “Abrir WhatsApp da secretaria em nova aba”, alvo HTTPS `https://wa.me/554888734629`, proteção `noopener noreferrer`, foco visível e altura mínima 44 px. Não há texto de mensagem pré-preenchido, chamada telefônica ou envio automático. A migração ainda local inicializa somente esse contato quando vazio e preserva qualquer valor institucional já configurado. Não foi enviado teste ao número; disponibilidade no WhatsApp não confirmada. Push/deploy continuam pendentes.
