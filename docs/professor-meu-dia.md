# Área do professor — Meu dia e pedidos

Professores entram em Meu dia, com atalhos, pedidos próprios em atendimento, próximas reservas aprovadas, xerox e formações. A navegação também permite Espaços, Xerox, Calendário, Formação e Meus pedidos. Gestão preserva sua Visão do dia; a prévia de professor continua somente leitura.

## Acompanhamento e cópias

Meus pedidos reúne reservas, xerox e solicitações de mensagens/materiais da própria conta, com filtros por serviço e situação. Os rótulos preservam os estados efetivos: Enviado para pedidos pendentes; Em análise somente quando registrada; Em produção para xerox nessa etapa; aprovado, concluído, devolvido ou recusado conforme cada serviço. Não há conclusão inferida de reservas nem histórico fictício de etapas.

Duplicar preenche somente dados reutilizáveis em um formulário novo. A data/prazo fica em branco e deve ser escolhida. Identidade, versão, aprovação e anexos não são copiados. Nenhuma gravação ocorre ao abrir a cópia; o salvamento usa os POST existentes e exige nova aprovação. A verificação de propriedade também ocorre no manipulador, e a prévia de gestão não pode duplicar.

## Espaços

Dia, Semana e Mês usam as mesmas reservas aprovadas e agendas fixas. A consulta de intervalo valida data e horários e mostra sobreposições reais; pedidos pendentes não ocupam o espaço. Um intervalo livre pode preencher um novo pedido, que permanece pendente e pode ser recusado se a ocupação mudar antes da aprovação.

## Lembretes

Reservas aprovadas de hoje até dois dias à frente aparecem no painel. Mudanças nas formações oficiais e da escola são comparadas com o primeiro acesso da conta neste navegador. Inclusão, alteração e retirada de encontros futuros são exibidas até marcar todas as alterações como vistas. O avanço natural da data não gera falsa retirada.

O registro de conferência usa armazenamento do próprio navegador separado por conta, sem sincronização entre dispositivos. Na indisponibilidade do armazenamento, funciona apenas na sessão atual e informa a limitação. A prévia de gestão não grava preferências. Nenhum envio externo ou serviço novo é criado.

Meu dia atualiza pelo botão, ao voltar à aba e a cada cinco minutos enquanto o painel estiver visível, sem formulário aberto ou salvamento em andamento. Falhas preservam os dados anteriores; não substituem o calendário por uma lista vazia.

## Validação e recuperação

Sem alteração de banco ou permissões de API. Checkpoint anterior: 657c774228a7419f4f04d50ab840c1ea02ab9cc4, Cloudflare 001314f0-b36a-46b9-b9f5-159f73ea6ffc. A reversão é um commit normal dos arquivos desta etapa; o registro local de lembretes pode permanecer sem afetar o banco.

Testes de interface cobrem propriedade, estados reais, cópias, datas, ocupação, persistência de lembretes, passagem de dias e prévia somente leitura. Teacher day QA exercita APIs e formulários com contas/banco fictícios em Chromium 320/390/768/1440 px, incluindo aprovação pendente, cópia sem anexo e mudança de formação após recarregar. Capturas devem ser revisadas antes da publicação. Resultado efetivo registrado no PR da entrega.
