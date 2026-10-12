# Melhorias de organização — outubro de 2026

## Reservas de espaços

As reservas pontuais e agendas fixas têm turma e disciplina opcionais, sem exigir alteração dos registros anteriores. Agendas fixas permanecem administradas pela direção: escolha um dia da semana, horários locais da escola (São Paulo) e datas inicial/final inclusivas. O período precisa conter ao menos uma ocorrência. A agenda exibe as ocorrências semanalmente e mensalmente, sem criar milhares de reservas independentes.

Editar ou remover uma agenda fixa afeta toda sua recorrência; cancelar uma reserva pontual afeta somente aquele encontro. Triggers de banco bloqueiam sobreposição entre reservas e agendas, incluindo edições concorrentes, permitindo horários adjacentes e períodos sem ocorrência em comum. IDs, responsáveis, horários e datas anteriores são preservados pela migração aditiva 0006.

## Xerox e anexos privados

Pedidos mantêm material, quantidade e prazo, e passam a informar professor, turma opcional e impressão preto e branco/colorida. O solicitante do login continua proprietário; o nome exibido do professor não transfere permissão. O fluxo de aprovação/ajustes/produção permanece.

Um arquivo PDF, PNG ou JPEG de até **256 KiB** pode acompanhar cada pedido. O backend verifica nome/extensão, MIME declarado, assinatura inicial, codificação e tamanho real; isso não é antivírus nem validação completa do formato. Arquivos são baixados como anexos, com nosniff, sandbox e sem cache. Professor proprietário e direção autorizada podem baixar; outros professores, inativos e não autenticados não podem. Listagens não incluem os bytes do arquivo.

O anexo fica no **D1 existente**, protegido pela API e pelo login/Access, sem bucket, URL pública, novo binding ou credencial. O limite conservador mantém linhas abaixo do [limite D1 de 2 MB](https://developers.cloudflare.com/d1/platform/limits/) e o upload usa parâmetros preparados. Pedidos antigos permanecem sem anexo, com impressão padrão preto e branco e nome do solicitante. Editar sem novo arquivo preserva o anterior; substituir/remover é atômico com o pedido e controle de versão. Apagar um pedido também apaga seu anexo. Nenhum arquivo de produção é incluído no GitHub ou testes.

Materiais maiores exigem uma decisão posterior de infraestrutura/limites; não há provisionamento automático de R2 nem armazenamento público como alternativa. O limite aparece no formulário. O D1 continua sujeito às cotas já existentes de uso e armazenamento; não se alega capacidade ilimitada.

## Formação integrada ao calendário

A área Formação mostra os mesmos registros do calendário, filtrados por tipo Formação. A direção cadastra título/data e pode acrescentar horário, local e informações de pauta; professores consultam. O filtro mensal e o filtro de formação não criam registros nem duplicam eventos. Sem cadastro, a área fica vazia. Horários são locais da escola. Edição e remoção usam controle de versão existente.

A migração 0008 adiciona campos, preservando eventos, IDs e permissões anteriores. Internamente, a marca de formação é independente da restrição histórica do tipo SQL; a API apresenta o tipo Formação. Nada foi importado de calendários ou mensagens privadas.
