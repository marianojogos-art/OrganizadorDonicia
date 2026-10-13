# Melhorias de organização — outubro de 2026

## Reservas de espaços

As reservas pontuais e agendas fixas têm turma e disciplina opcionais, sem exigir alteração dos registros anteriores. Agendas fixas permanecem administradas pela equipe pedagógica: escolha um dia da semana, horários locais da escola (São Paulo) e datas inicial/final inclusivas. O período precisa conter ao menos uma ocorrência. A agenda exibe as ocorrências semanalmente e mensalmente, sem criar milhares de reservas independentes.

Editar ou remover uma agenda fixa afeta toda sua recorrência; cancelar uma reserva pontual afeta somente aquele encontro. Triggers de banco bloqueiam sobreposição entre reservas aprovadas e agendas, incluindo edições concorrentes, permitindo horários adjacentes e períodos sem ocorrência em comum. IDs, responsáveis, horários e datas anteriores são preservados pela migração aditiva 0006.

Professores solicitam reservas com situação **Pendente**. A equipe pedagógica aprova ou recusa; somente **Aprovada** ocupa o horário. Pedidos pendentes podem coincidir e a aprovação valida conflitos de forma atômica. Professores podem cancelar seus pedidos e editar os pendentes/recusados; a edição reenvia como pendente. A equipe cria reservas diretamente aprovadas. Registros anteriores permanecem aprovados pela migração 0010.

## Xerox e anexos privados

Pedidos mantêm material, quantidade e prazo, e passam a informar professor, turma opcional e impressão preto e branco/colorida. O solicitante do login continua proprietário; o nome exibido do professor não transfere permissão. O fluxo de aprovação/ajustes/produção permanece.

Um arquivo PDF, PNG ou JPEG de até **256 KiB** pode acompanhar cada pedido. O backend verifica nome/extensão, MIME declarado, assinatura inicial, codificação e tamanho real; isso não é antivírus nem validação completa do formato. Arquivos são baixados como anexos, com nosniff, sandbox e sem cache. Professor proprietário e equipe pedagógica autorizada podem baixar; outros professores, inativos e não autenticados não podem. Listagens não incluem os bytes do arquivo.

O anexo fica no **D1 existente**, protegido pela API e pelo login/Access, sem bucket, URL pública, novo binding ou credencial. O limite conservador mantém linhas abaixo do [limite D1 de 2 MB](https://developers.cloudflare.com/d1/platform/limits/) e o upload usa parâmetros preparados. Pedidos antigos permanecem sem anexo, com impressão padrão preto e branco e nome do solicitante. Editar sem novo arquivo preserva o anterior; substituir/remover é atômico com o pedido e controle de versão. Apagar um pedido também apaga seu anexo. Nenhum arquivo de produção é incluído no GitHub ou testes.

Materiais maiores exigem uma decisão posterior de infraestrutura/limites; não há provisionamento automático de R2 nem armazenamento público como alternativa. O limite aparece no formulário. O D1 continua sujeito às cotas já existentes de uso e armazenamento; não se alega capacidade ilimitada.

## Formação integrada ao calendário

A área Formação mostra os mesmos registros do calendário, identificados como formação. A equipe pedagógica cadastra título, área e data, podendo acrescentar horário, local e informações de pauta; professores consultam. A projeção `/api/trainings` usa os mesmos IDs e traduz observações para os detalhes do evento. Os filtros por mês e área não criam registros nem duplicam eventos; o calendário mantém o filtro por tipo. Sem cadastro, a área fica vazia. Horários são locais da escola. Edição e remoção usam controle de versão existente.

A migração 0008 adiciona campos, preservando eventos, IDs e permissões anteriores. Internamente, a marca de formação é independente da restrição histórica do tipo SQL; a API apresenta o tipo Formação. A migração 0010 adiciona a área e mantém os registros existentes; formações legadas recebem a área Geral. O anexo com o calendário oficial ainda não foi disponibilizado, portanto nenhuma data foi inventada nem importada de calendários ou mensagens privadas.

## Notas pessoais por login

Minhas notas permite à equipe pedagógica criar, editar e remover lembretes em cartões amarelos, azuis, rosas ou verdes. Título até 120 caracteres e texto até 4000, com controle de versão contra sobrescrita concorrente. Texto é escapado no HTML; não há interpretação de links, scripts ou markup.

A API consulta e altera notas apenas com `owner=email autenticado`, inclusive na consulta individual, edição e exclusão. Não há exceção para a direção; ela acessa somente as próprias notas. Um ID alheio retorna 404 antes de revelar a versão. O cliente não escolhe o proprietário, e login inativo/não autenticado é bloqueado. Auditoria registra ação/ID, nunca título ou conteúdo. A privacidade é no acesso do aplicativo; administradores autorizados da infraestrutura continuam administrando o banco e seus backups. Não se trata de criptografia de ponta a ponta.

A migração 0009 cria somente tabela e índice novos. As notas são persistidas no D1 e seguem o login, sem armazenamento público ou cache. Nenhuma nota de outro login é carregada para filtragem na interface. Com a separação de perfis, professores não acessam notas. Testes usam supervisão, orientação e direção fictícias, com tentativas explícitas de acesso cruzado pela API e bloqueio dos professores. Notas existentes permanecem no banco; a mudança de acesso não as apaga.

## Portal público e calendário interno

Estudantes, responsáveis e visitantes acessam `/` sem login para consultar apresentação, avisos publicados, contatos e eventos públicos. A opção discreta **Acesso de funcionários** leva a `/equipe`. Em **Comunicação pública**, a equipe mantém os dados institucionais e controla a publicação dos avisos; rascunhos não são retornados pela API pública.

A equipe define a visibilidade de cada evento como Interno ou Público. Eventos anteriores permanecem internos. A API anônima retorna somente campos destinados à comunidade; reservas, xerox, notas, atas, cadastros e formações internas continuam protegidos. A abertura em produção depende do [ajuste do Access por caminhos](deploy.md#portal-público-e-acesso-de-funcionários), com validação de JWT e autorização nominal preservadas no Worker.

## Verificação anterior na nuvem

Marcos foram validados com lint, tipagem, testes de API/banco, testes móveis, build, reprodução dos runtimes e dry-run Wrangler. Chromium headless no executor conferiu formação e notas em 1280×900 e 390×844, sem transbordamento horizontal, e realizou upload real pela FileReader/ponte do formulário de um PDF fictício e download autenticado na demonstração local. Nenhuma credencial, dado escolar real ou imagem da conversa foi usada.

O CI e a integração Cloudflare são acompanhados por commit. A consulta HTTP direta do executor ao domínio de produção recebeu `CONNECT tunnel failed, response 403` do proxy, antes de chegar ao site; não comprova falha do aplicativo. Testes locais e build aprovado não substituem uma sessão institucional autenticada de produção. Access, audiência, extensão SGE e outros projetos não foram alterados.

## Verificação da integração do portal

Os resultados acima pertencem às melhorias anteriores ao portal. A integração da migração 0010, da separação de perfis e dos calendários compartilhados deve ser validada pela CI do commit integrado; não reutilizar totais de testes de outra base como evidência. O relatório da etapa deve identificar SHA, execução da CI e situação do deployment, distinguindo verificações anônimas de login institucional real.
